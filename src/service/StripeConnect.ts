import {StripeAuthorisationError} from '../error/StripeAuthorisationError';
import {CardError} from '../error/CardError';
import {ChargeError} from '../error/ChargeError';
import {RefundError} from '../error/RefundError';
import {StripeConnectConfiguration} from '../configuration/StripeConnectConfiguration';
import * as rp from 'request-promise-native';
import {PaymentCard} from '../model/PaymentCard';
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
     * @param token The token of the tokenised card.
     *
     * @return {Promise<any>} a Stripe Customer object.
     *
     * @see https://stripe.com/docs/api/node#create_customer
     */
    async createCustomer(email: string, tokenId: string): Promise<any> {
        try {
            let customer = await stripe(this.stripeSecretKey).customers.create({
                email: email,
                source: tokenId,
            });
            return customer;
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
     * @see https://stripe.com/docs/api/node#retrieve_token
     * @see https://stripe.com/docs/api#tokens
     */
    async retrieveToken(tokenId: string): Promise<any> {
        try {
            let stripeToken = await stripe(this.stripeSecretKey).tokens.retrieve(tokenId);
            return stripeToken;
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
     * @return {Promise<PaymentCard>} a PaymentCard object.
     *
     * @see https://stripe.com/docs/api/node#create_card
     */
    async createCard(customerId: string, tokenId: string): Promise<any> {
        try {
            let stripeSource = await stripe(this.stripeSecretKey).customers.createSource(customerId, { source: tokenId });
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
     * @see https://stripe.com/docs/api/node#delete_card
     */
    async removeCard(customerId: string, cardId: string): Promise<any> {
        try {
            let deletion = await stripe(this.stripeSecretKey).customers.deleteCard(customerId, cardId);
            return deletion;
        } catch (error) {
            throw new CardError(error);
        }
    }

    /**
     * Loads all payment cards of a given customer.
     *
     * @param customer ID of the existing customer to retrieve the cards for.
     *
     * @return {Promise<PaymentCard[]>} a Stripe PaymentCard[] object.
     *
     * @see https://stripe.com/docs/api/node#list_cards
     */
    async loadCards(customerId: string): Promise<PaymentCard[]> {
        try {
            let cards = await stripe(this.stripeSecretKey).customers.listCards(customerId);
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
     * @return {Promise<any[]>} a Stripe Charge[] object.
     *
     * @see https://stripe.com/docs/api/node#list_cards
     */
    async loadCharges(stripeAccount: string, limit: number | undefined): Promise<any[]> {
        try {
            let charges = await stripe(this.stripeSecretKey).charges.list({
                limit: limit
            }, {
                stripe_account: stripeAccount
            });
            return (charges.data as any[])
        } catch (error) {
            throw new CardError(error);
        }
    }

    /**
     * Creates a new charge by a token id. Can be used for customers whose card details we do no hold.
     *
     * @param stripeAccount The connected stripe account to credit.
     *
     * @param token For most Stripe users, the source of every charge is a credit or debit card. This hash is then the card
     *      object describing that card. This is created by the Stripe.js front end javascript.
     *
     * @param customer ID of the existing customer this charge is for, if one exists.
     *
     * @param amountInCents The value to be charged to the customer. A positive integer in the smallest currency unit (e.g.,
     *      100 cents to charge $1.00 or 100 to charge ¥100, a zero-decimal currency) representing how much to charge the
     *      card. The minimum amount is $0.50 US or equivalent in charge currency.
     *
     * @param applicationFeeInCents A fee in cents that will be applied to the charge and transferred to the application owner's
     *      Stripe account.
     *
     * @param currency The currency of the transaction.  3-letter ISO code for currency.
     *
     * @param description An arbitrary string which you can attach to a Charge object. It is displayed when in the web interface
     *      alongside the charge. Note that if you use Stripe to send automatic email receipts to your customers, your
     *      receipt emails will include the description of the charge(s) that they are describing.
     *
     * @param idempotency_key  A unique key used for ensuring the card is not charged multiple times in the case of an error.
     *          How you create unique keys is up to you, but Stripe suggests using V4 UUIDs or another appropriately random string.
     *          Stripe will always send back the same response for requests made with the same key, and keys can't be reused with
     *          different request parameters. Keys expire after 24 hours.
     *
     * @param metadata Set of key/value pairs that you can attach to an object. It can be useful for storing additional
     *      information about the object in a structured format. Individual keys can be unset by posting an empty value
     *      to them. All keys can be unset by posting an empty value to metadata.
     *
     * @return {Promise<any>} a Stripe Charge object.
     *
     * @see https://stripe.com/docs/api/node#charges
     * @see https://stripe.com/docs/api/node#create_charge
     * @see https://stripe.com/docs/charges
     */
    async createChargeByToken(stripeAccount: string, token: string, customer: string | undefined, amountInCents: number, applicationFeeInCents: number, currency: string, description: string, idempotency_key: string, metadata: any ): Promise<any> {
        console.log('token: ', token);

        let delay = 1000;
        let retries = 0;
        let complete = false;

        while (retries < 3 && !complete) {    // retry this 3 times in the case of an error...any more and the delay is too much due to exponential backoff.
            try {
                let charge = await stripe(this.stripeSecretKey).charges.create({
                    amount: amountInCents,
                    currency: currency,
                    description: description,
                    customer: customer,
                    application_fee: applicationFeeInCents,
                    source: token,
                    metadata: metadata
                }, {
                    stripe_account: stripeAccount,
                    idempotency_key: idempotency_key
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

    /**
     * Creates a new charge for a customer. Must be a previously saved customer.
     *
     * @param stripeAccount The connected stripe account to credit.
     * 
     * @param card The id of the card to be charged. If you also pass in a customer, the card must be the ID of a card belonging
     *      to the customer.
     *
     * @param customer The customer for whom the card belongs to. The customer (owned by the application's
     *      account) to create a token for. This can only be used with an OAuth access token or Stripe-Account header.
     *      For more details, see Stripe's shared customers documentation.
     *
     * @param amountInCents The value to be charged to the customer. A positive integer in the smallest currency unit (e.g.,
     *      100 cents to charge $1.00 or 100 to charge ¥100, a zero-decimal currency) representing how much to charge the
     *      card. The minimum amount is $0.50 US or equivalent in charge currency.
     *
     * @param applicationFeeInCents A fee in cents that will be applied to the charge and transferred to the application owner's
     *      Stripe account.
     *
     * @param currency The currency of the transaction.  3-letter ISO code for currency.
     *
     * @param description An arbitrary string which you can attach to a Charge object. It is displayed when in the web interface
     *      alongside the charge. Note that if you use Stripe to send automatic email receipts to your customers, your
     *      receipt emails will include the description of the charge(s) that they are describing.
     *
     * @param idempotency_key  A unique key used for ensuring the card is not charged multiple times in the case of an error.
     *          How you create unique keys is up to you, but Stripe suggests using V4 UUIDs or another appropriately random string.
     *          Stripe will always send back the same response for requests made with the same key, and keys can't be reused with
     *          different request parameters. Keys expire after 24 hours.
     *
     * @param metadata Set of key/value pairs that you can attach to an object. It can be useful for storing additional
     *      information about the object in a structured format. Individual keys can be unset by posting an empty value
     *      to them. All keys can be unset by posting an empty value to metadata.
     *
     * @return {Promise<any>} a Stripe Charge object.
     *
     * @see https://stripe.com/docs/api/node#charges
     * @see https://stripe.com/docs/api/node#create_charge
     * @see https://stripe.com/docs/charges
     */
    async createChargeByCard(stripeAccount: string, card: string, customer: string | undefined, amountInCents: number, applicationFeeInCents: number, currency: string, description: string, idempotency_key: string, metadata: any): Promise<any> {
        console.log('card: ', card);

        let cardToken = await stripe(this.stripeSecretKey).tokens.create({
            card: card,
            customer: customer
        }, {
            stripe_account: stripeAccount,
        });

        let delay = 1000;
        let retries = 0;
        let complete = false;
        while (retries < 3 && !complete) {  // retry this 3 times in the case of an error...any more and the delay is too much  due to exponential backoff.
            try {
                let charge = await stripe(this.stripeSecretKey).charges.create({
                    amount: amountInCents,
                    currency: currency,
                    description: description,
                    application_fee: applicationFeeInCents,
                    source: cardToken.id,
                    metadata: metadata
                }, {
                    stripe_account: stripeAccount,
                    idempotency_key: idempotency_key
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


    /**
     * Creates a new refund by a charge token id.
     *
     * @param stripeAccount The connected stripe account to debit.
     * @param chargeToken The identifier of the charge to refund.
     * @param reason  String indicating the reason for the refund. If set, possible values are duplicate, fraudulent, and
     *      requested_by_customer. Specifying fraudulent as the reason when you believe the charge to be fraudulent
     *      will help us improve our fraud detection algorithms. Defaults to "request_by_customer".
     * @param refundApplicationFee Boolean indicating whether the application fee should be refunded when refunding this
     *      charge. If a full charge refund is given, the full application fee will be refunded. Else, the application fee
     *      will be refunded with an amount proportional to the amount of the charge refunded. An application fee can only
     *      be refunded by the application that created the charge.
     * @param amountInCents A positive integer in cents representing how much of this charge to refund. Can only refund up to
     *      the unrefunded amount remaining of the charge. If undefined then the full amount will be refunded.
     *
     * @return {Promise<any>} a Stripe Refund object.
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
                let refund = await stripe(this.stripeSecretKey).refunds.create({
                    charge: chargeToken,
                    amount: amountInCents,
                    refund_application_fee: refundApplicationFee,
                    reason: reason
                }, {
                    stripe_account: stripeAccount,
                });
                return refund;
            } catch (error) {
                console.log(error);
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
     * @param param tokenOrCode The token received from the Stripe *AFTER* granting access to the platform.  This will be
     *          depending on the grant_type. See Stripe docs for further details.
     * @param param grantType 'authorization_code' | 'refresh_token' authorization_code when turning an authorization
     *          code into an access token, or refresh_token when using a refresh token to get a new access token.
     *
     * @returns {Promise<any>}
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

}
