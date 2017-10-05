# stripe-connect

Provides a simple promise based api for working with the Stripe Connect API. As it currently stands, this class only deals with Standard (Standalone)
accounts and direct charges.

- create customers
- load all of the saved cards for a customer
- save card for customer
- delete card for customer
- connect a new Connect account to the platform
- disconnect a new Connect account to the platform
- create a refund for a charge
- create a charge for a saved card
- create a charge for a new card

A Standard Stripe account is a conventional Stripe account controlled directly by the account holder (i.e., your
platform’s user). A user with a Standard account has a relationship with Stripe, is able to log in to the Dashboard,
can process charges on their own, and can disconnect their account from your platform.
  
Creating direct charges on the connected account is particularly appropriate for platforms that enable e-commerce 
for its users. An end customer is purchasing from an individual business, not the platform, and the business can 
easily see their own sales in their Stripe Dashboard.

Using this direct charge  approach:
- The connected account is responsible for the cost of the Stripe fees, refunds, and chargebacks
- The payment itself appears as a charge in the connected account, not in your platform account
- Charges directly increase the connected account’s balance
- Your platform’s balance is only increased via application fees
 
It would be worth familiarising oneself with the oauth workflow for standard accounts.

## Developers

`git clone https://github.com/raceloop/stripe-connect.git;`

`cd stripe-connect`

`mv ./test/TestingStripeConnectionConfiguration.ts.dist ./test/TestingStripeConnectionConfiguration.ts`


For the setting up the test harness change the values in the `./test/TestingStripeConnectionConfiguration.ts`
to those which match your Stripe environment.

## Stripe Documentation

https://stripe.com/docs/connect/standard-accounts

https://stripe.com/docs/connect/direct-charges

https://stripe.com/docs/connect/standard-accounts#oauth-flow

## Usage

Because this API satisfies a fraction of Stripe's API it has not been NPM'd. This will give you the chance to extend it as you see fit.

This api is to be used server side only.

```
/**
 * Set up the configuration object.
 */
const config: StripeConnectConfiguration = new StripeConnectConfiguration();
config.stripeConnectAuthorizeURL = 'https://connect.stripe.com/oauth/token';
config.stripeConnectDeAuthorizeURL = 'https://connect.stripe.com/oauth/deauthorize';
config.stripeClientId = 'ca_AMysbjNeWG7ayPoxmCzyBfYKzkc856lW';
config.stripeSecretKey = 'sk_test_NRwn1XGzA93GAsdDQd3UM7qg';

/**
 * Instantiate the StripeConnect object by passing in the config into the constructor.
 */
const stripeConnect = new StripeConnect(config);
```


Best not to place the configuration parameters into code. Instead, they can (for example) be placed in config files (remember to add your config
file to .gitignore etc) or into environment variables.

The test class gives a number of examples that can be used to help get started with using this api.

## Stripe Setup

Create the Stripe account for your platform as per Stripe documentation. Set up the
configuration object accepts the values taken from your Stripe console. 

## Licence

MIT
