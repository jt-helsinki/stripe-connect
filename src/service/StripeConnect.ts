import {StripeAuthorisationError} from '../error/StripeAuthorisationError';
import {CardError} from '../error/CardError';
import {ChargeError} from '../error/ChargeError';
import {RefundError} from '../error/RefundError';
import {StripeConnectConfiguration} from '../configuration/StripeConnectConfiguration';
import * as rp from 'request-promise-native';
import {PaymentCard} from '../model/PaymentCard';
import {ChargeParameters} from '../model/ChargeParameters';
const stripe = require('stripe');


/**
 * Provides integration with Stripe Connect API. As it currently stands, this class only deals with Standard (Standalone)
 * accounts and direct charges.
 *
 * - create customers
 * - load all of the saved cards for a customer
 * - save card for customer
 * - delete card for customer
 * - connect a new Connect account to the platform
 * - disconnect a new Connect account to the platform
 * - create a refund for a charge
 * - create a charge for a saved card
 * - create a charge for a new card
 *
 * A Standard Stripe account is a conventional Stripe account controlled directly by the account holder (i.e., your
 * platform’s user). A user with a Standard account has a relationship with Stripe, is able to log in to the Dashboard,
 * can process charges on their own, and can disconnect their account from your platform.
 *
 * Creating direct charges on the connected account is particularly appropriate for platforms that enable e-commerce
 * for its users. An end customer is purchasing from an individual business, not the platform, and the business can
 * easily see their own sales in their Stripe Dashboard.
 *
 * Using this approach:
 *  - The connected account is responsible for the cost of the Stripe fees, refunds, and chargebacks
 *  - The payment itself appears as a charge in the connected account, not in your platform account
 *  - Charges directly increase the connected account’s balance
 *  - Your platform’s balance is only increased via application fees
 *
 * It would be worth familiarising oneself with the oauth workflow for standard accounts.
 *
 * @see https://stripe.com/docs/connect/standard-accounts
 * @see https://stripe.com/docs/connect/direct-charges
 * @see https://stripe.com/docs/connect/standard-accounts#oauth-flow
 */
export class StripeConnect {

    // -------------------------------------------------------------------------
    // Private Properties
    // -------------------------------------------------------------------------

    /**
     * Stripe API token used by the platform to interact with stripe servers. This can be found in the Stripe console.
     */
    private stripeSecretKey: string;

    /**
     * The Stripe client id of the platform as found in the Stripe console.
     */
    private stripeClientId: string;

    /**
     * This endpoint is used both for turning an authorization_code into an access_token, and for
     * getting a new access token using a refresh_token.
     *
     * Ordinarily this should be:
     *
     *      https://connect.stripe.com/oauth/token
     */
    private stripeConnectAuthorizeURL: string;

    /**
     * This endpoint is used for revoking access to an account.
     *
     *  Ordinarily this should be:
     *
     *      https://connect.stripe.com/oauth/deauthorize
     */
    private stripeConnectDeAuthorizeURL: string;

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /**
     * Constructructs a new object.
     *
     * @param configuration The configuration object used to connect this instance to the Stripe payment gateway.
     */
    constructor(configuration: StripeConnectConfiguration) {
        this.stripeSecretKey = configuration.stripeSecretKey;
        this.stripeClientId = configuration.stripeClientId;
        this.stripeConnectAuthorizeURL = configuration.stripeConnectAuthorizeURL;
        this.stripeConnectDeAuthorizeURL = configuration.stripeConnectDeAuthorizeURL;
    }

    // -------------------------------------------------------------------------
    // Public Methods
    // -------------------------------------------------------------------------

    /**
     * Creates a new customer on the stripe service with a given user's email.
     *
     * @param email The email address of the customer. It’s displayed alongside the customer in your dashboard and can be
     *      useful for searching and tracking. This can be unset by updating the value to null and then saving.
     * @param tokenId The token of the tokenised card.
     *
     * @return {Promise<any>} a Stripe Customer object.
     *
     * @throws CardError
     *
     * @see https://stripe.com/docs/api/node#create_customer
     */
    async createCustomer(email: string, tokenId: string): Promise<any> {
        try {
            return stripe(this.stripeSecretKey).customers.create({
                email: email,
                source: tokenId,
            });
        } catch (error) {
            throw new CardError(error);
        }
    }

    /**
     * Loads recently generated token details by a given token id.
     *
     * Tokenization is the process Stripe uses to collect sensitive card or bank account details, or personally
     * identifiable information (PII), directly from your customers in a secure manner. A Token representing this
     * information is returned to the server to use. You should use Checkout, Elements, or our mobile libraries to
     * perform this process, client-side. This ensures that no sensitive card data touches your server and allows your
     * integration to operate in a PCI compliant way.
     *
     * Tokens cannot be stored or used more than once—to store card or bank account information for later use, create
     * Customer objects or Custom accounts. In addition, Radar, our integrated solution for automatic fraud protection,
     * only supports integrations that make use of client-side tokenization.
     *
     * @param tokenId The token of the tokenised card.
     *
     * @return {Promise<any>} the tokensied representation of the card.
     *
     * @throws CardError
     *
     * @see https://stripe.com/docs/api/node#retrieve_token
     * @see https://stripe.com/docs/api#tokens
     */
    async retrieveToken(tokenId: string): Promise<any> {
        try {
            return stripe(this.stripeSecretKey).tokens.retrieve(tokenId);
        } catch (error) {
            throw new CardError(error);
        }
    }

    /**
     * Creates a new stripe card for the given customer. Keep in mind that the card has already been tokenised before
     * this method is called.
     *
     * If a customerId is not available then a new customer must be created using the createCustomer() method of this service.
     *
     * @param customerId the Stripe id of the customer.
     * @param tokenId The token of the tokenised card.
     *
     * @return {Promise<PaymentCard>} a PaymentCard object. See Stripe docs for futher details.
     *
     * @throws CardError
     *
     * @see https://stripe.com/docs/api/node#create_card
     */
    async createCard(customerId: string, tokenId: string): Promise<any> {
        try {
            const stripeSource = await stripe(this.stripeSecretKey).customers.createSource(customerId, { source: tokenId });
            return this.buildFromStripeCard(stripeSource);
        } catch (error) {
            throw new CardError(error);
        }


    }

    /**
     * Removes a card for a customer.
     *
     * @param customerId ID of the existing customer to retrieve the cards for.
     * @param cardId ID of the existing card to remove.
     *
     * @throws CardError
     *
     * @see https://stripe.com/docs/api/node#delete_card
     */
    async removeCard(customerId: string, cardId: string): Promise<any> {
        try {
            return stripe(this.stripeSecretKey).customers.deleteCard(customerId, cardId);
        } catch (error) {
            throw new CardError(error);
        }
    }

    /**
     * Loads all payment cards of a given customer.
     *
     * @param customerId ID of the existing customer to retrieve the cards for.
     *
     * @return {Promise<PaymentCard[]>} a Stripe PaymentCard[] object.
     *
     * @throws CardError
     *
     * @see https://stripe.com/docs/api/node#list_cards
     */
    async loadCards(customerId: string): Promise<PaymentCard[]> {
        try {
            const cards = await stripe(this.stripeSecretKey).customers.listCards(customerId);
            // transform stripe cards into payment cards and return to the client
            return (cards.data as any[]).map(stripeCard => this.buildFromStripeCard(stripeCard));
        } catch (error) {
            throw new CardError(error);
        }
    }

    /**
     * Loads all charges for a stripe account. Note, customers are associated to the platform and not to the
     * connected account. Charges are associated with the connected account and not with the platform. With this in mind,
     * we can not retrieve all the charges for a customer.
     *
     * @param stripeAccount The connected stripe account to for which the charges relate to.
     * @param limit A limit on the number of objects to be returned. Limit can range between 1 and 100 items,
     *      and the default is 10 items.
     *
     * @return {Promise<any[]>} a Stripe Charge[] object. See Stripe docs for futher details.
     *
     * @throws CardError the charge was not successful. i.e. declined card.
     *
     * @see https://stripe.com/docs/api/node#list_cards
     */
    async loadCharges(stripeAccount: string, limit: number | undefined): Promise<any[]> {
        try {
            const charges = await stripe(this.stripeSecretKey).charges.list({
                limit: limit
            }, {
                stripe_account: stripeAccount
            });
            return (charges.data as any[]);
        } catch (error) {
            throw new CardError(error);
        }
    }

    /**
     * Creates a new charge by a token id. Can be used for customers whose card details we do no hold.
     *
     * @param stripeAccount The connected stripe account to credit.
     * @param token For most Stripe users, the source of every charge is a credit or debit card. This hash is then the card
     *      object describing that card. This is created by the Stripe.js front end javascript.
     * @param paramters the object containing the specifics of the financial transaction. Must implement the ChargeParameters interface.
     *
     * @return {Promise<any>} a Stripe Charge object. See Stripe docs for futher details.
     *
     * @throws ChargeError the charge was not successful. i.e. declined card.
     *
     * @see https://stripe.com/docs/api/node#charges
     * @see https://stripe.com/docs/api/node#create_charge
     * @see https://stripe.com/docs/charges
     */
    async createChargeByToken(stripeAccount: string, token: string, paramters: ChargeParameters ): Promise<any> {
        return this.makeCharge(stripeAccount, token, paramters);
    }

    /**
     * Creates a new charge for a customer. Must be a previously saved customer.
     *
     * @param stripeAccount The connected stripe account to credit.
     * @param card The id of the card to be charged. If you also pass in a customer, the card must be the ID of a card belonging
     *      to the customer.
     * @param paramters the object containing the specifics of the financial transaction. Must implement the ChargeParameters interface.
     *
     * @return {Promise<any>} a Stripe Charge object. See Stripe docs for futher details.
     *
     * @throws ChargeError
     *
     * @see https://stripe.com/docs/api/node#charges
     * @see https://stripe.com/docs/api/node#create_charge
     * @see https://stripe.com/docs/charges
     */
    async createChargeByCard(stripeAccount: string, card: string, paramters: ChargeParameters): Promise<any> {
        const cardToken = await stripe(this.stripeSecretKey).tokens.create({
            card: card,
            customer: paramters.customer
        }, {
            stripe_account: stripeAccount,
        });
        return this.makeCharge(stripeAccount, cardToken.id, paramters);
    }


    /**
     * Creates a new refund by a charge token id.
     *
     * @param stripeAccount The connected stripe account to debit.
     * @param chargeToken The identifier of the charge to refund.
     * @param reason  String indicating the reason for the refund. If set, possible values are duplicate, fraudulent, and
     *      requested_by_customer. Specifying fraudulent as the reason when you believe the charge to be fraudulent
     *      will help us improve our fraud detection algorithms. Defaults to 'request_by_customer'.
     * @param refundApplicationFee Boolean indicating whether the application fee should be refunded when refunding this
     *      charge. If a full charge refund is given, the full application fee will be refunded. Else, the application fee
     *      will be refunded with an amount proportional to the amount of the charge refunded. An application fee can only
     *      be refunded by the application that created the charge.
     * @param amountInCents A positive integer in cents representing how much of this charge to refund. Can only refund up to
     *      the unrefunded amount remaining of the charge. If undefined then the full amount will be refunded.
     *
     * @return {Promise<any>} a Stripe Refund object. See Stripe docs for futher details.
     *
     * @throws RefundError
     *
     * @see https://stripe.com/docs/api/node#refunds
     * @see https://stripe.com/docs/refunds
     */
    async createRefundForCharge(stripeAccount: string, chargeToken: string, reason: string = 'request_by_customer', refundApplicationFee: boolean = true, amountInCents?: number | undefined): Promise<any> {
        let delay = 1000;
        let retries = 0;
        let complete = false;

        while (retries < 3 && !complete) {  // retry this 3 times in the case of an error...any more and the delay is too much  due to exponential backoff.
            try {
                const refund = await stripe(this.stripeSecretKey).refunds.create({
                    charge: chargeToken,
                    amount: amountInCents,
                    refund_application_fee: refundApplicationFee,
                    reason: reason
                }, {
                    stripe_account: stripeAccount,
                });
                complete = true;
                return refund;
            } catch (error) {
                if (error.rawType === 'invalid_request_error') {
                    return {
                        id: 'STRIPE_DASHBOARD',
                        balance_transaction: error.message,
                        amount: amountInCents,
                        charge: chargeToken
                    };
                } else if (retries < 2) {
                    await this.runWithDelay(delay, () => console.log(error));
                    delay = delay * 2;
                    retries++;
                } else {
                    throw new RefundError(error);
                }
            }
        }
    }

    /**
     * Connects a connected account to the platform.  This should be called AFTER access has been granted to the platform.
     * Once access has been granted, Stripe will provide a token that is used to tie the connected account to the platform.
     * This method is the final step in that process.
     *
     * Example response:
     *
     *      {
     *          access_token: 'sk_test_xxxxxxxxxxxxx',
     *          livemode: false,
     *          refresh_token: 'rt_xxxxxxxxxxxxxxxxxx',
     *          token_type: 'bearer',
     *          stripe_publishable_key: 'pk_test_xxxxxxxxxxxxxxxx',
     *          stripe_user_id: 'acct_xxxxxxxxxxxxxx',
     *          scope: 'read_write'
     *      }
     *
     * @param tokenOrCode The token received from the Stripe *AFTER* granting access to the platform.  This will be
     *          depending on the grant_type. See Stripe docs for further details.
     * @param grantType 'authorization_code' | 'refresh_token' authorization_code when turning an authorization
     *          code into an access token, or refresh_token when using a refresh token to get a new access token.
     *
     * @returns {Promise<any>}
     *
     * @throws StripeAuthorisationError
     *
     * @see https://stripe.com/docs/connect/connecting-to-accounts
     * @see https://stripe.com/docs/connect/oauth-reference#post-token
     */
    async connectAccountToStripeConnect(tokenOrCode: string, grantType: 'authorization_code' | 'refresh_token' = 'authorization_code'): Promise<any> {
        const options: any = {
            method: 'POST',
            uri: this.stripeConnectAuthorizeURL,
            form: {
                grant_type: grantType,
                client_id: this.stripeClientId,
                client_secret: this.stripeSecretKey
            }
        };

        if (grantType === 'authorization_code') {
            options.form.code = tokenOrCode;
        } else {
            options.form.refresh_token = tokenOrCode;
        }

        try {
            const responseFromServer: any =  await rp.post(options);
            return JSON.parse(responseFromServer);
        } catch (error) {
            throw new StripeAuthorisationError(error.error);
        }
    }

    /**
     * Disconnects a connected account to the platform.
     *
     * @param stripeUserId The account you'd like to disconnect from.
     *
     * @returns {Promise<any>}
     *
     * @throws StripeAuthorisationError
     *
     * @see https://stripe.com/docs/connect/connecting-to-accounts
     * @see https://stripe.com/docs/connect/oauth-reference#post-deauthorize
     */
    async disconnectAccountFromStripeConnect(stripeUserId: string): Promise<any> {

        const options: any = {
            method: 'POST',
            uri: this.stripeConnectDeAuthorizeURL,
            form: {
                client_id: this.stripeClientId,
                stripe_user_id: stripeUserId
            },
            headers: {'Authorization': `Bearer ${this.stripeSecretKey}`},
        };

        try {
            const responseFromServer: any =  await rp.post(options);
            return JSON.parse(responseFromServer);
        } catch (error) {
            throw new StripeAuthorisationError(error.error);
        }
    }

    // -------------------------------------------------------------------------
    // Private methods
    // -------------------------------------------------------------------------

    /**
     * Creates a new promise with delay. After given relay promise will be resolved and given results will be returned
     * in the promise result.
     */
    runWithDelay<T>(delay: number, result?: T): Promise<T> {
        return new Promise(ok => setTimeout(() => ok(result), delay));
    }

    /**
     * Builds PaymentCard from a given stripe card.
     */
    private buildFromStripeCard(stripeCard: any): PaymentCard {
        const paymentCard = new PaymentCard();
        paymentCard.id = stripeCard.id;
        paymentCard.brand = stripeCard.brand;
        paymentCard.expirationMonth = stripeCard.exp_month;
        paymentCard.expirationYear = stripeCard.exp_year;
        paymentCard.lastFourDigits = stripeCard.last4;
        return paymentCard;
    }

    /**
     * Makes the actual charge.
     *
     * @param stripeAccount The connected stripe account to credit.
     * @param token For most Stripe users, the source of every charge is a credit or debit card. This hash is then the card
     *      object describing that card. This is created by the Stripe.js front end javascript.
     * @param paramters the object containing the specifics of the financial transaction. Must implement the ChargeParameters interface.
     *
     * @return {Promise<any>} Stripe charge object. See Stripe docs.
     *
     * @throws the charge was not successful. i.e. declined card.
     */
    private async makeCharge(stripeAccount: string, token: string, paramters: ChargeParameters): Promise<any> {
        let delay = 1000;
        let retries = 0;
        let complete = false;

        while (retries < 3 && !complete) {    // retry this 3 times in the case of an error...any more and the delay is too much due to exponential backoff.
            try {
                const charge = await stripe(this.stripeSecretKey).charges.create({
                    amount: paramters.amountInCents,
                    currency: paramters.currency,
                    description: paramters.description,
                    application_fee: paramters.applicationFeeInCents,
                    source: token,
                    metadata: paramters.metadata
                }, {
                    stripe_account: stripeAccount,
                    idempotency_key: paramters.idempotency_key
                });
                complete = true;
                return charge;
            } catch (error) {
                if (retries < 2) {
                    await this.runWithDelay(delay, () => console.log(error));
                    delay = delay * 2;
                    retries++;
                } else {
                    throw new ChargeError(error);
                }

            }
        }

    }



}
