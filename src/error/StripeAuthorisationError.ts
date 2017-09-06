export class StripeAuthorisationError extends Error  {

    constructor(message: string) {
        super(message);
        this.stack = undefined;
    }

}
