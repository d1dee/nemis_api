export default class CustomError extends Error {
    code: number;
    type: string;

    /**
     * A custom error message allow for HTTP codes as error code to be used by the API
     * @param message A brief explanation of why the error happen
     * @param type Brief name of the error
     * @param code HTTP status code to be used by the API while reporting to the user
     * @param cause Optional information stating the cause of the error, or any additional information to be sent to the user eg, validation error
     */
    constructor(message: string, code: number, type?: string, cause?: any) {
        super(message);
        this.type = type || "Internal server error";
        this.code = (code >= 400 || code <= 550) ? code : 500;
        this.cause = cause;
        // Set the prototype explicitly to ensure correct inheritance
        Object.setPrototypeOf(this, CustomError.prototype);
    }
}
