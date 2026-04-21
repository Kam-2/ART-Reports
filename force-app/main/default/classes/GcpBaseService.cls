/**
 * GcpBaseService (Optimized)
 * Handles authentication, HTTP callouts, retry, and utilities
 */
/**
 * ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
 * Class Name      : GcpBaseService
 * Author          : <YourName>
 * Created Date    : Apr 7, 2026
 * Last Modified By: <YourName>
 * Last Modified On: Apr 21, 2026
 * Description     : Handles authentication, HTTP callouts, retry, and utilities
 *                   for GCP Reports integration.
 *  
 * Change History  :
 *  Date          │   Author     │   Change
 * ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
 *  Apr 7,  2026  │ <YourName>   │ Initial version
 *  Apr 21, 2026  │ <YourName>   │ Added buildRequest(), fixed retry bug in send(),
 *               │              │ added System.debug logging throughout
 * ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
 */
public with sharing class GcpBaseService {

    private static final String  CLASS_NAME         = 'GcpBaseService';
    private static final String  AUTH_ENDPOINT      = '/auth/salesforce';
    private static final Integer TOKEN_CACHE_HOURS  = 1;

    private static String   cachedToken;
    private static Datetime tokenExpiry;

    // =========================
    // AUTH TOKEN
    // =========================
    public static String getAuthToken() {

        String method = CLASS_NAME + '.getAuthToken';

        // Return cached token if still valid
        if (cachedToken != null && tokenExpiry != null && Datetime.now() < tokenExpiry) {
            System.debug(LoggingLevel.FINE, method + ' >> Using cached token. Expires: ' + tokenExpiry);
            return cachedToken;
        }

        System.debug(LoggingLevel.INFO, method + ' >> Cached token missing or expired. Fetching new token...');

        HttpRequest req = new HttpRequest();
        req.setEndpoint('callout:GCP_Reports' + AUTH_ENDPOINT);
        req.setMethod('POST');
        req.setHeader('x-sf-user-id', UserInfo.getUserId());
        req.setTimeout(120000);

        System.debug(LoggingLevel.FINE, method + ' >> Auth request endpoint: ' + req.getEndpoint());

        HttpResponse res;
        try {
            res = new Http().send(req);
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, method + ' >> Auth callout exception: ' + e.getMessage());
            throw new CalloutException('Auth callout failed: ' + e.getMessage());
        }

        System.debug(LoggingLevel.INFO, method + ' >> Auth response status: ' + res.getStatusCode());
        System.debug(LoggingLevel.FINE, method + ' >> Auth response body: '   + res.getBody());

        if (res.getStatusCode() != 200 && res.getStatusCode() != 201) {
            System.debug(LoggingLevel.ERROR, method + ' >> Auth failed. Status: ' + res.getStatusCode() + ' Body: ' + res.getBody());
            throw new CalloutException('Auth failed: ' + res.getBody());
        }

        Map<String, Object> body = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
        Map<String, Object> data = (Map<String, Object>) body.get('data');

        cachedToken = (String) data.get('token');

        if (String.isBlank(cachedToken)) {
            System.debug(LoggingLevel.ERROR, method + ' >> Token missing in auth response. Body: ' + res.getBody());
            throw new CalloutException('Token missing in response');
        }

        tokenExpiry = Datetime.now().addHours(TOKEN_CACHE_HOURS);
        System.debug(LoggingLevel.INFO, method + ' >> Token fetched successfully. Expires: ' + tokenExpiry);

        return cachedToken;
    }

    // =========================
    // BUILD REQUEST
    // =========================
    private static HttpRequest buildRequest(String endpoint, String method, String body) {

        String logCtx = CLASS_NAME + '.buildRequest';
        System.debug(LoggingLevel.FINE, logCtx + ' >> method=' + method + ' endpoint=' + endpoint);

        HttpRequest req = new HttpRequest();
        req.setEndpoint('callout:GCP_Reports' + endpoint);
        req.setMethod(method);
        req.setHeader('Content-Type', 'application/json');
        req.setHeader('Authorization', 'Bearer ' + getAuthToken());
        req.setTimeout(30000);

        if (body != null) {
            req.setBody(body);
            System.debug(LoggingLevel.FINE, logCtx + ' >> Request body: ' + body);
        }

        return req;
    }

    // =========================
    // CORE REQUEST METHOD
    // =========================
    public static HttpResponse send(String endpoint, String method, String body) {

        String logCtx = CLASS_NAME + '.send';
        System.debug(LoggingLevel.INFO, logCtx + ' >> START method=' + method + ' endpoint=' + endpoint);

        HttpRequest  req = buildRequest(endpoint, method, body);
        HttpResponse res;

        try {
            res = new Http().send(req);
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, logCtx + ' >> Callout exception: ' + e.getMessage());
            throw e;
        }

        // Retry once on auth failure with fresh token
        if (res.getStatusCode() == 401) {
            System.debug(LoggingLevel.WARN, logCtx + ' >> 401 received. Invalidating token and retrying...');
            cachedToken = null;

            req = buildRequest(endpoint, method, body);
            try {
                res = new Http().send(req);
            } catch (Exception e) {
                System.debug(LoggingLevel.ERROR, logCtx + ' >> Retry callout exception: ' + e.getMessage());
                throw e;
            }

            if (res.getStatusCode() == 401) {
                System.debug(LoggingLevel.ERROR, logCtx + ' >> Still 401 after retry. Auth failure persists.');
            }
        }

        System.debug(LoggingLevel.INFO, logCtx + ' >> END');
        return res;
    }

    // Overload — GET with no body
    public static HttpResponse send(String endpoint) {
        return send(endpoint, 'GET', null);
    }

    // =========================
    // SAFE RESPONSE PARSER
    // =========================
    public static Map<String, Object> parse(HttpResponse res) {

        String logCtx = CLASS_NAME + '.parse';
        System.debug(LoggingLevel.INFO, logCtx + ' >> Parsing response. Status: ' + res.getStatusCode());

        try {
            if (res.getStatusCode() != 200) {
                System.debug(LoggingLevel.WARN, logCtx + ' >> Non-200 status: ' + res.getStatusCode() + ' Body: ' + res.getBody());
                return new Map<String, Object>{
                    'success'    => false,
                    'message'    => res.getBody(),
                    'statusCode' => res.getStatusCode()
                };
            }

            Map<String, Object> raw = (Map<String, Object>) JSON.deserializeUntyped(res.getBody());

            if (raw == null) {
                return error('Empty response');
            }

            if (raw.containsKey('success') && !(Boolean) raw.get('success')) {
                return error('API returned success = false');
            }

            System.debug(LoggingLevel.FINE, logCtx + ' >> Parse successful.');
            return new Map<String, Object>{
                'success' => true,
                'data'    => raw.containsKey('data') ? raw.get('data') : raw
            };

        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, logCtx + ' >> Parse exception: ' + e.getMessage() + ' | Body: ' + res.getBody());
            return error('Parse error: ' + e.getMessage());
        }
    }

    // =========================
    // PRIVATE HELPERS
    // =========================
    private static Map<String, Object> error(String msg) {
        System.debug(LoggingLevel.ERROR, CLASS_NAME + '.error >> ' + msg);
        return new Map<String, Object>{
            'success' => false,
            'message' => msg
        };
    }
}