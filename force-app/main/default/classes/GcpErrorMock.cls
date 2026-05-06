@IsTest
global class GcpErrorMock implements HttpCalloutMock {

    global HTTPResponse respond(HTTPRequest req) {

        HttpResponse res = new HttpResponse();

        // Auth should succeed
        if (req.getEndpoint().contains('/auth/salesforce')) {
            res.setStatusCode(200);
            res.setBody('{"data":{"token":"test_token"}}');
        }

        // Force failure for reports → triggers error()
        else if (req.getEndpoint().contains('/reports')) {
            res.setStatusCode(500); // 🔥 important
            res.setBody('Internal Server Error');
        }

        // fallback
        else {
            res.setStatusCode(200);
            res.setBody('{"success":false}');
        }

        return res;
    }
}