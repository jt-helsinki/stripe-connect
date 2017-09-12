import {suite, test, timeout} from 'mocha-typescript';
import { assert, expect } from 'chai';
import * as uuid from 'uuid';
import {StripeConnect, StripeConnectConfiguration, PaymentCard, ChargeParameters} from '../src';
import {TestingStripeConnectionConfiguration} from './TestingStripeConnectionConfiguration';

@suite()
class UnitTest {


    stripeConnect: StripeConnect;

    idempotencyKey: string;

    before() {
        this.idempotencyKey = uuid.v4();    // the idempotency key must be a different each time.
        const config: StripeConnectConfiguration = TestingStripeConnectionConfiguration.config();
        this.stripeConnect = new StripeConnect(config);
    }


    @test()
    'should retrieve 1 card'(done: any) {
        this.stripeConnect.loadCards(TestingStripeConnectionConfiguration.STRIPE_CUSTOMER).then( (cards) => {
            assert(cards.length >= 1);
        }).then(() => {
            done();
        }).catch((error) => {
            done(error);
        });
    }

    @test()
    @timeout(20000)
    'should make one charge on existing card'(done: any) {
        this.stripeConnect.loadCards(TestingStripeConnectionConfiguration.STRIPE_CUSTOMER).then(cards => {
            const card = cards[0];
            const paramters: ChargeParameters = {
                customer: TestingStripeConnectionConfiguration.STRIPE_CUSTOMER,
                amountInCents: 10000,
                applicationFeeInCents: 50,
                currency: 'EUR',
                description:  'a unit test generate charge',
                idempotency_key: this.idempotencyKey,
                metadata: {chargeFor: 'test charge', user: 'TEST SCRIPT'}
            };
            this.stripeConnect.createChargeByCard(TestingStripeConnectionConfiguration.STRIPE_ACCOUNT, card.id, paramters).then(charge => {
                expect(charge.outcome.network_status).to.equal('approved_by_network');
            }).then( () => {
                done();
            }).catch((error) => {
                done(error);
            });
        });
    }

    @test()
    @timeout(20000)
    'should attempt a declined charge on new card and throw exceptopm'(done: any) {
        const paramters: ChargeParameters = {
            customer: undefined,
            amountInCents: 10000,
            applicationFeeInCents: 50,
            currency: 'EUR',
            description:  'a unit test generate charge',
            idempotency_key: this.idempotencyKey,
            metadata: {chargeFor: 'test charge', user: 'TEST SCRIPT'}
        };

        this.stripeConnect.createChargeByToken(TestingStripeConnectionConfiguration.STRIPE_ACCOUNT, 'tok_chargeDeclined', paramters).catch((error) => {
            try {
                expect(error.message).to.equal('Error: Your card was declined.');
                done();
            } catch (error) {
                done(error);
            }
        });
    }

    @test()
    @timeout(20000)
    'should make one charge on new card'(done: any) {
        const paramters: ChargeParameters = {
            customer: undefined,
            amountInCents: 10000,
            applicationFeeInCents: 50,
            currency: 'EUR',
            description:  'a unit test generate charge',
            idempotency_key: this.idempotencyKey,
            metadata: {chargeFor: 'test charge', user: 'TEST SCRIPT'}
        };
        this.stripeConnect.createChargeByToken(TestingStripeConnectionConfiguration.STRIPE_ACCOUNT, 'tok_visa_debit', paramters).then(charge => {
            expect(charge.outcome.network_status).to.equal('approved_by_network');
        }).then( () => {
            done();
        }).catch((error) => {
            done(error);
        });
    }

    @test()
    @timeout(20000)
    'should create a new card for customer'(done: any) {
            this.stripeConnect.createCard(TestingStripeConnectionConfiguration.STRIPE_CUSTOMER, 'tok_visa_debit').then((card: PaymentCard) => {
                console.log(card);
                expect(card.expirationMonth).to.equal(8);
                expect(card.expirationYear).to.equal(2019);
                expect(card.lastFourDigits).to.equal('5556');
                expect(card.brand).to.equal('Visa');
            }).then( () => {
                done();
            }).catch((error) => {
                done(error);
            });
    }

    @test()
    @timeout(20000)
    'should delete a card for customer'(done: any) {
        this.stripeConnect.loadCards(TestingStripeConnectionConfiguration.STRIPE_CUSTOMER).then((cards: PaymentCard[]) => {
            const cardToDelete = cards[cards.length - 1];
            this.stripeConnect.removeCard(TestingStripeConnectionConfiguration.STRIPE_CUSTOMER, cardToDelete.id).then(card => {
                expect(card.deleted).to.equal(true);
                expect(card.id).to.equal(cardToDelete.id);
            }).then( () => {
                done();
            }).catch((error) => {
                done(error);
            });
        });
    }



    @test()
    @timeout(20000)
    'should list all charges for account'(done: any) {
            this.stripeConnect.loadCharges(TestingStripeConnectionConfiguration.STRIPE_ACCOUNT, 2).then(charges => {
                expect(charges.length).to.equal(2);
            }).then( () => {
                done();
            }).catch((error) => {
                done(error);
            });
    }



    @test()
    @timeout(20000)
    'should list 10 charges'(done: any) {
            this.stripeConnect.loadCharges(TestingStripeConnectionConfiguration.STRIPE_ACCOUNT, undefined).then(charges => {
                expect(charges.length).to.equal(10);
            }).then( () => {
                done();
            }).catch((error) => {
                done(error);
            });
    }

    @test()
    @timeout(20000)
    'should refund a charge for an account'(done: any) {
        this.stripeConnect.loadCharges(TestingStripeConnectionConfiguration.STRIPE_ACCOUNT, 1).then(charges => {
            const charge = charges[0];
            this.stripeConnect.createRefundForCharge(TestingStripeConnectionConfiguration.STRIPE_ACCOUNT, charge.id, 'requested_by_customer', true, undefined).then( (refund) => {
                expect(refund.amount).to.equal(10000);
                expect(refund.currency).to.equal('eur');
                expect(refund.reason).to.equal('requested_by_customer');
                expect(refund.status).to.equal('succeeded');
                expect(refund.charge).to.equal(charge.id);
            }).then(() => {
                done();
            }).catch((error) => {
                done(error);
            });
        });
    }
}