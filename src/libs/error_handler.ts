export default class CustomError extends Error {
    code: number | undefined;

    /**
     * A custom error message allow for HTTP codes as error code to be used by the API
     * @param message A brief explanation of why the error happen
     * @param code HTTP status code to be used by the API while reporting to the user
     * @param cause Optional information stating the cause of the error, or any additional information to be sent to the user eg, validation error
     */
    constructor(message: string, code?: number, cause?: any) {
        super(message);

        this.code = code;
        this.cause = cause ?? { stack: this.stack, message: message, code: code };
        // Set the prototype explicitly to ensure correct inheritance
        Object.setPrototypeOf(this, CustomError.prototype);
    }
}
