/**
 * An interface which represents the paramters to be passed into the functions of the StripeConnect class.
 */

export interface ChargeParameters {

    /**
     * ID of the existing customer this charge is for, if one exists.
     */
    customer: string | undefined;

    /**
     * The value to be charged to the customer. A positive integer in the smallest currency unit (e.g.,
     * 100 cents to charge $1.00 or 100 to charge ¥100, a zero-decimal currency) representing how much to charge the
     * card. The minimum amount is $0.50 US or equivalent in charge currency.
     */
    amountInCents: number;

    /**
     * A fee in cents that will be applied to the charge and transferred to the application owner's Stripe account.
     */
    applicationFeeInCents: number;

    /**
     * The currency of the transaction.  3-letter ISO code for currency.
     */
    currency: string;

    /**
     * An arbitrary string which you can attach to a Charge object. It is displayed when in the web interface
     * alongside the charge. Note that if you use Stripe to send automatic email receipts to your customers, your
     * receipt emails will include the description of the charge(s) that they are describing.
     */
    description: string;

    /**
     * A unique key used for ensuring the card is not charged multiple times in the case of an error.
     * How you create unique keys is up to you, but Stripe suggests using V4 UUIDs or another appropriately random string.
     * Stripe will always send back the same response for requests made with the same key, and keys can't be reused with
     * different request parameters. Keys expire after 24 hours.
     */
    idempotency_key: string;

    /**
     * Set of key/value pairs that you can attach to an object. It can be useful for storing additional
     * information about the object in a structured format. Individual keys can be unset by posting an empty value
     * to them. All keys can be unset by posting an empty value to metadata.
     */
    metadata: any;

}
