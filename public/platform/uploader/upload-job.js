var inherits = require('inherits');
var EventEmitter = require('eventemitter3');
var UploadUrlRequest = require('../../../src/platform/management/requests/upload-url-request');
var FileDescriptor = require('../../../src/platform/management/metadata/file-descriptor');
var UploadStartedEvent = require('./events/upload-started-event');
var UploadProgressEvent = require('./events/upload-progress-event');
var UploadSuccessEvent = require('./events/upload-success-event');
var UploadErrorEvent = require('./events/upload-error-event');
var UploadAbortedEvent = require('./events/upload-aborted-event');

/**
 * @param {string?} path
 * @param {File?} file
 * @param {UploadFileRequest?} uploadFileRequest
 * @constructor
 * @extends {EventEmitter}
 */
function UploadJob(path, file, uploadFileRequest) {
    EventEmitter.call(this);

    /**
     * @type {string}
     */
    this.path = path;

    /**
     * @type {File}
     */
    this.file = file;

    /**
     * @type {UploadFileRequest}
     */
    this.uploadFileRequest = uploadFileRequest;

    /**
     * @type {string}
     */
    this.state = 'stopped';
}
inherits(UploadJob, EventEmitter);

/**
 * @param {string} path
 * @returns {UploadJob}
 */
UploadJob.prototype.setPath = function (path) {
    this.path = path;
    return this;
};

/**
 * @param {File} file
 * @returns {UploadJob}
 */
UploadJob.prototype.setFile = function (file) {
    this.file = file;
    return this;
};

/**
 * @param {UploadFileRequest} uploadFileRequest
 * @returns {UploadJob}
 */
UploadJob.prototype.setUploadFileRequest = function (uploadFileRequest) {
    this.uploadFileRequest = uploadFileRequest;
    return this;
};

/**
 * @param fileUploader
 * @returns {UploadJob}
 */
UploadJob.prototype.run = function (fileUploader) {

    if (this.state === 'running') {
        console.warn('job already running');
        return this;
    }
    this.state = 'running';

    var acl = 'public';
    if (this.uploadFileRequest && this.uploadFileRequest.acl) {
        acl = this.uploadFileRequest.acl
    }

    var e = new UploadStartedEvent(this);
    this.emit(e.name, e);
    var uploadUrlRequest = new UploadUrlRequest()
        .setPath(this.path)
        .setAcl(acl)
        .setMimeType(this.file.type)
        .setSize(this.file.size);
    fileUploader.getUploadUrl(uploadUrlRequest, function (error, response) {

        if (error) {
            var e = new UploadErrorEvent(this, error);
            this.emit(e.name, e);
            return;
        }

        var onProgress = function (event) {
            var e = new UploadProgressEvent(this, event.loaded, event.total);
            this.emit(e.name, e);
        }.bind(this);

        var onLoad = function (event) {
            var e;
            if (event.target.status >= 400) {
                e = new UploadErrorEvent(this, event.target.response);
            } else {
                var payload = typeof(event.target.response) === 'string' ?
                    JSON.parse(event.target.response).payload : event.target.response.payload;
                var fileDescriptors = payload.map(function (file) {
                    return new FileDescriptor(file);
                });

                e = new UploadSuccessEvent(this, event.target.response, fileDescriptors);
            }
            this.emit(e.name, e);
        }.bind(this);

        var onError = function (event) {
            var e = new UploadErrorEvent(this, event.target.response);
            this.emit(e.name, e);
        }.bind(this);

        var onAbort = function (event) {
            var e = new UploadAbortedEvent(this);
            this.emit(e.name, e);
        }.bind(this);

        var onLoadEnd = function (event) {
            reset();
            this.emit('upload-end');
        }.bind(this);

        var reset = function () {
            request.upload.removeEventListener('progress', onProgress);
            request.removeEventListener('load', onLoad);
            request.removeEventListener('error', onError);
            request.removeEventListener('abort', onAbort);
            request.removeEventListener('loadend', onLoadEnd);
            this.state = 'stopped';
        }.bind(this);

        var formData = new FormData();
        formData.append('uploadToken', response.uploadToken);
        formData.append('path', this.path);
        formData.append('file', this.file);
        formData.append('acl', acl);

        var request = new XMLHttpRequest();

        request.upload.addEventListener('progress', onProgress);
        request.addEventListener('load', onLoad);
        request.addEventListener('error', onError);
        request.addEventListener('abort', onAbort);
        request.addEventListener('loadend', onLoadEnd);

        request.open('POST', response.uploadUrl);

        request.withCredentials = true;
        request.responseType = 'json';

        request.send(formData);
    }.bind(this));

    return this;
};

/**
 * @type {UploadJob}
 */
module.exports = UploadJob;