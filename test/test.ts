// Reference mocha-typescript's global definitions:
/// <reference path='../node_modules/mocha-typescript/globals.d.ts' />

import { assert, expect } from 'chai';
import * as uuid from 'uuid';
import {StripeConnect, StripeConnectConfiguration} from '../src';
import {PaymentCard} from '../src/model/PaymentCard';
import {TestingStripeConnectionConfiguration} from "./TestingStripeConnectionConfiguration";

@suite 
class UnitTest {


    stripeConnect: StripeConnect;

    idempotencyKey: string;

    before() {
        this.idempotencyKey = uuid.v4();
        const config: StripeConnectConfiguration = TestingStripeConnectionConfiguration.config();
        this.stripeConnect = new StripeConnect(config);
    }


    @test()
    'should retrieve 1 card'(done: any) {
        this.stripeConnect.loadCards('cus_B8Fbacc6tlHrhV').then( (cards) => {
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
        this.stripeConnect.loadCards('cus_B8Fbacc6tlHrhV').then(cards => {
            const card = cards[0];
            const metadata = {chargeFor: 'test charge', user: 'JT'};
            this.stripeConnect.createChargeByCard('acct_1AB1KmLwXdxekwcS', card.id, 'cus_B8Fbacc6tlHrhV', 10000, 50, 'EUR', 'a unit test generate charge', this.idempotencyKey, metadata).then(charge => {
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
    'should make one charge on new card'(done: any) {
        this.stripeConnect.loadCards('cus_B8Fbacc6tlHrhV').then((cards: PaymentCard[]) => {
            const metadata = {chargeFor: 'test charge', user: 'JT'};
            this.stripeConnect.createChargeByToken('acct_1AB1KmLwXdxekwcS', 'tok_visa_debit', undefined, 10000, 50, 'EUR', 'a unit test generate charge', this.idempotencyKey, metadata).then(charge => {
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
    'should create a new card for customer'(done: any) {
            this.stripeConnect.createCard('cus_B8Fbacc6tlHrhV', 'tok_visa_debit').then((card: PaymentCard) => {
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
        this.stripeConnect.loadCards('cus_B8Fbacc6tlHrhV').then((cards: PaymentCard[]) => {
            const cardToDelete = cards[cards.length - 1];
            this.stripeConnect.removeCard('cus_B8Fbacc6tlHrhV', cardToDelete.id).then(card => {
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
            this.stripeConnect.loadCharges('acct_1AB1KmLwXdxekwcS', 2).then(charges => {
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
            this.stripeConnect.loadCharges('acct_1AB1KmLwXdxekwcS', undefined).then(charges => {
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
        this.stripeConnect.loadCharges('acct_1AB1KmLwXdxekwcS', 1).then(charges => {
            const charge = charges[0];
            this.stripeConnect.createRefundForCharge('acct_1AB1KmLwXdxekwcS', charge.id, 'requested_by_customer', true, undefined).then( (refund) => {
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