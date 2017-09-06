export class RefundError extends Error  {

    constructor(message: string) {
        super(message);
        this.stack = undefined;
    }

}
