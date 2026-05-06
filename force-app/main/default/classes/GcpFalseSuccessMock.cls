@IsTest
global class GcpFalseSuccessMock implements HttpCalloutMock {

    global HTTPResponse respond(HTTPRequest req) {

        HttpResponse res = new HttpResponse();

        if (req.getEndpoint().contains('/auth/salesforce')) {
            res.setStatusCode(200);
            res.setBody('{"data":{"token":"test_token"}}');
        } else {
            res.setStatusCode(200);
            res.setBody('{"success":false}');
        }

        return res;
    }
}