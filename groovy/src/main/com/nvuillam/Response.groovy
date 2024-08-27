package com.nvuillam

import com.fasterxml.jackson.annotation.JsonInclude
import com.fasterxml.jackson.annotation.JsonInclude.Include
import com.fasterxml.jackson.annotation.JsonRawValue
import groovy.transform.CompileStatic

/**
 * Represents a lint result.
 */
@JsonInclude(Include.NON_NULL)
@CompileStatic
class Response {

    // Status.
    int statusCode
    String status

    // Detected files.
    List<String> fileList

    // Errors.
    String errorMessage
    String errorDtl
    String exceptionType
    Map<String, List<String>> parseErrors

    // Lint result.
    @JsonRawValue
    String jsonResult
    String stdout

    /**
     * Sets a successful JSON lint result.
     *
     * @param jsonResult the json formatted lint result.
     */
    void setJsonResult(String jsonResult) {
        setSuccess()
        this.jsonResult = jsonResult
    }

    /**
     * Sets a successful lint result.
     *
     * @param lintResult the json formatted lint result.
     */
    void setStdout(String stdout) {
        setSuccess()
        this.stdout = stdout
    }

    /**
     * Sets a successful lint result.
     */
    void setSuccess() {
        this.statusCode = HttpURLConnection.HTTP_OK
        this.status = 'success'
    }

    /**
     * Sets the response status to indicate the request as interrupted.
     */
    void setInterrupted() {
        this.statusCode = 444
        this.status = 'cancelledByDuplicateRequest'
    }

    /**
     * Sets the response status to indicate a failure.
     *
     * @param t the error that provides the details to report.
     */
    void setError(Throwable t) {
        this.statusCode = HttpURLConnection.HTTP_INTERNAL_ERROR
        this.status = 'error'
        this.errorMessage = t.message
        this.errorDtl = t.stackTrace.join('\n')
        this.exceptionType = t.class.name
    }

    /**
     * Sets the response status to indicate a not found failure.
     *
     * @param e the error that provides the details to report.
     */
    void setNotFound(FileNotFoundException e) {
        this.statusCode = HttpURLConnection.HTTP_NOT_FOUND
        this.status = 'notFound'
        this.errorMessage = e.message
        this.errorDtl = e.stackTrace.join('\n')
        this.exceptionType = e.class.name
    }

}
