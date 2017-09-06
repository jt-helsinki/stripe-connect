/**
 * Holds the basic configuration for associating the service with a Stripe account that accepts connected entries.
 */
export class StripeConnectConfiguration {

    /**
     * Stripe API secret key as taken from the Stripe console.
     */
    public stripeSecretKey: string;

    /**
     * The Stripe client id of the platform as found in the Stripe console.
     */
    public stripeClientId: string;

    /**
     * This endpoint is used both for turning an authorization_code into an access_token, and for
     * getting a new access token using a refresh_token.
     *
     * Ordinarily this should be:
     *
     *      https://connect.stripe.com/oauth/token
     */
    public stripeConnectAuthorizeURL: string;

    /**
     * This endpoint is used for revoking access to an account.
     *
     *  Ordinarily this should be:
     *
     *
     */
    public stripeConnectDeAuthorizeURL: string;

}
