export class ChargeError extends Error  {

    constructor(message: string) {
        super(message);
        this.stack = undefined;
    }

}
