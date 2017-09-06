export class CardError extends Error  {

    constructor(message: string) {
        super(message);
        this.stack = undefined;
    }

}
