/**
 * Used to store user's cards data.
 */
export class PaymentCard {

    /**
     * Unique card id.
     */
    id: string;

    /**
     * Card brand. Can be visa, mastercard, etc.
     */
    brand: string;

    /**
     * Card expiration month.
     */
    expirationMonth: number;

    /**
     * Card expiration year.
     */
    expirationYear: number;

    /**
     * Card last 4 digests.
     */
    lastFourDigits: string;

}
