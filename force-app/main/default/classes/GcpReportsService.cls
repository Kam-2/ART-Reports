/**
 * ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
 * Class Name      : GcpReportsService
 * Author          : <YourName>
 * Created Date    : Apr 7, 2026
 * Last Modified By: <YourName>
 * Last Modified On: Apr 21, 2026
 * Description     : Exposes @AuraEnabled methods for GCP report endpoints.
 *                   Delegates HTTP + auth to GcpBaseService.
 *  
 * Change History  :
 *  Date          │   Author     │   Change
 * ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
 *  Apr 7,  2026  │ <YourName>   │ Initial version
 *  Apr 21, 2026  │ <YourName>   │ Replaced sendRequest() with GcpBaseService.send();
 *               │              │ removed duplicate handleResponse() in favour of
 *               │              │ GcpBaseService.parse(); refactored getAllZoneAndAmbassadorIds()
 *               │              │ and getZonePicklist(); added System.debug logging
 * ――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――――
 */
public with sharing class GcpReportsService {

    private static final String CLASS_NAME = 'GcpReportsService';

    // =========================
    // PRIVATE HELPERS
    // =========================

    // Build base endpoint with date range
    private static String buildBase(String path, String startDate, String endDate) {
        return path
            + '?start_date=' + EncodingUtil.urlEncode(startDate, 'UTF-8')
            + '&end_date='   + EncodingUtil.urlEncode(endDate,   'UTF-8');
    }

    // Append a comma-joined list param (skipped when list is empty/null)
    private static String appendListParam(String endpoint, String paramName, List<String> values) {
        if (values != null && !values.isEmpty()) {
            endpoint += '&' + paramName + '='
                + EncodingUtil.urlEncode(String.join(values, ','), 'UTF-8');
            System.debug(LoggingLevel.FINE, CLASS_NAME + '.appendListParam >> Added ' + paramName + '=' + values);
        }
        return endpoint;
    }

    // =========================
    // BOUNDARIES
    // =========================

    @AuraEnabled(cacheable=true)
    public static Map<String, List<String>> getAllZoneAndAmbassadorIds() {

        String logCtx = CLASS_NAME + '.getAllZoneAndAmbassadorIds';
        System.debug(LoggingLevel.INFO, logCtx + ' >> START');

        Map<String, List<String>> result = new Map<String, List<String>>();

        try {
            Map<String, Object> response =
                GcpBaseService.parse(GcpBaseService.send('/boundaries'));

            if (!(Boolean) response.get('success')) {
                System.debug(LoggingLevel.ERROR, logCtx + ' >> Failed: ' + response.get('message'));
                throw new AuraHandledException(
                    'Failed to fetch boundaries: ' + response.get('message')
                );
            }

            Map<String, Object> data  = (Map<String, Object>) response.get('data');
            List<Object>        zones = (List<Object>) data.get('zones');

            System.debug(LoggingLevel.INFO, logCtx + ' >> Zone count: ' + (zones != null ? zones.size() : 0));

            List<String> zoneIds       = new List<String>();
            List<String> ambassadorIds = new List<String>();

            for (Object z : zones) {
                Map<String, Object> zone = (Map<String, Object>) z;
                String zoneId = (String) zone.get('zone_id');
                zoneIds.add(zoneId);
                System.debug(LoggingLevel.FINE, logCtx + ' >> Zone: ' + zoneId);

                if (zone.containsKey('ambassadors')) {
                    List<Object> ambassadors = (List<Object>) zone.get('ambassadors');
                    System.debug(LoggingLevel.FINE, logCtx + ' >> Ambassadors in zone ' + zoneId + ': ' + ambassadors.size());

                    for (Object a : ambassadors) {
                        Map<String, Object> amb = (Map<String, Object>) a;
                        ambassadorIds.add((String) amb.get('id'));
                    }
                }
            }

            result.put('zoneIds',       zoneIds);
            result.put('ambassadorIds', ambassadorIds);

            System.debug(LoggingLevel.INFO, logCtx + ' >> END. zoneIds=' + zoneIds.size() + ' ambassadorIds=' + ambassadorIds.size());
            return result;

        } catch (AuraHandledException ahe) {
            throw ahe;
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, logCtx + ' >> Exception: ' + e.getMessage() + '\n' + e.getStackTraceString());
            throw new AuraHandledException('Error: ' + e.getMessage());
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getZonePicklist() {

        String logCtx = CLASS_NAME + '.getZonePicklist';
        System.debug(LoggingLevel.INFO, logCtx + ' >> START');

        List<Map<String, String>> zoneList = new List<Map<String, String>>();

        try {
            Map<String, Object> response =
                GcpBaseService.parse(GcpBaseService.send('/boundaries'));

            if (!(Boolean) response.get('success')) {
                System.debug(LoggingLevel.ERROR, logCtx + ' >> GCP returned success=false: ' + response.get('message'));
                throw new AuraHandledException(
                    'GCP returned success = false: ' + response.get('message')
                );
            }

            Map<String, Object> data  = (Map<String, Object>) response.get('data');
            List<Object>        zones = (List<Object>) data.get('zones');

            System.debug(LoggingLevel.INFO, logCtx + ' >> Zone count: ' + (zones != null ? zones.size() : 0));

            for (Object obj : zones) {
                Map<String, Object> zone    = (Map<String, Object>) obj;
                Map<String, String> zoneMap = new Map<String, String>();
                zoneMap.put('label', (String) zone.get('name'));
                zoneMap.put('value', (String) zone.get('zone_id'));
                zoneList.add(zoneMap);
                System.debug(LoggingLevel.FINE, logCtx + ' >> Added zone: ' + zoneMap);
            }

            System.debug(LoggingLevel.INFO, logCtx + ' >> END. Total zones: ' + zoneList.size());
            return zoneList;

        } catch (AuraHandledException ahe) {
            throw ahe;
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, logCtx + ' >> Exception: ' + e.getMessage() + '\n' + e.getStackTraceString());
            throw new AuraHandledException('Failed to fetch zones: ' + e.getMessage());
        }
    }

    // =========================
    // DASHBOARD
    // =========================

    @AuraEnabled
    public static Map<String, Object> getDashboardMetrics(
        String  startDate,
        String  endDate,
        Boolean bypassCache
    ) {
        String logCtx = CLASS_NAME + '.getDashboardMetrics';
        System.debug(LoggingLevel.INFO, logCtx + ' >> START startDate=' + startDate + ' endDate=' + endDate + ' bypassCache=' + bypassCache);

        String endpoint = '/reports/dashboard'
            + '?start_date='   + EncodingUtil.urlEncode(startDate, 'UTF-8')
            + '&end_date='     + EncodingUtil.urlEncode(endDate,   'UTF-8')
            + '&bypass_cache=' + String.valueOf(bypassCache);

        try {
            Map<String, Object> result = GcpBaseService.parse(GcpBaseService.send(endpoint));
            System.debug(LoggingLevel.INFO, logCtx + ' >> END success=' + result.get('success'));
            return result;
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, logCtx + ' >> Exception: ' + e.getMessage() + '\n' + e.getStackTraceString());
            return new Map<String, Object>{ 'success' => false, 'message' => e.getMessage() };
        }
    }

    @AuraEnabled
    public static Map<String, Object> getTopPerformer(String startDate, String endDate) {

        String logCtx = CLASS_NAME + '.getTopPerformer';
        System.debug(LoggingLevel.INFO, logCtx + ' >> START startDate=' + startDate + ' endDate=' + endDate);

        String endpoint = '/reports/dashboard'
            + '?start_date='   + EncodingUtil.urlEncode(startDate, 'UTF-8')
            + '&end_date='     + EncodingUtil.urlEncode(endDate,   'UTF-8')
            + '&bypass_cache=true';

        try {
            Map<String, Object> response =
                GcpBaseService.parse(GcpBaseService.send(endpoint));

            if (!(Boolean) response.get('success')) {
                System.debug(LoggingLevel.WARN, logCtx + ' >> Response not successful: ' + response.get('message'));
                return response;
            }

            Map<String, Object> data         = (Map<String, Object>) response.get('data');
            Object              topPerformer = data != null ? data.get('top_performer') : null;

            System.debug(LoggingLevel.INFO, logCtx + ' >> END. top_performer found: ' + (topPerformer != null));
            return new Map<String, Object>{
                'success' => true,
                'data'    => topPerformer
            };

        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, logCtx + ' >> Exception: ' + e.getMessage() + '\n' + e.getStackTraceString());
            return new Map<String, Object>{ 'success' => false, 'message' => e.getMessage() };
        }
    }

    // =========================
    // ZONE COVERAGE
    // =========================

    @AuraEnabled
    public static Map<String, Object> getZoneCoverage(
        String       startDate,
        String       endDate,
        List<String> ambassadorIds,
        List<String> zoneIds
    ) {
        String logCtx = CLASS_NAME + '.getZoneCoverage';
        System.debug(LoggingLevel.INFO, logCtx + ' >> START startDate=' + startDate + ' endDate=' + endDate
            + ' ambassadorIds=' + ambassadorIds + ' zoneIds=' + zoneIds);

        String endpoint = buildBase('/reports/zone-coverage', startDate, endDate);
        endpoint = appendListParam(endpoint, 'ambassador_id', ambassadorIds);
        endpoint = appendListParam(endpoint, 'zone_id',       zoneIds);

        try {
            Map<String, Object> result = GcpBaseService.parse(GcpBaseService.send(endpoint));
            System.debug(LoggingLevel.INFO, logCtx + ' >> END success=' + result.get('success'));
            return result;
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, logCtx + ' >> Exception: ' + e.getMessage() + '\n' + e.getStackTraceString());
            return new Map<String, Object>{ 'success' => false, 'message' => e.getMessage() };
        }
    }

    // =========================
    // MISSED CHECKPOINTS
    // =========================

    @AuraEnabled
    public static Map<String, Object> getMissedCheckpoints(
        String       startDate,
        String       endDate,
        List<String> zoneIds,
        List<String> ambassadorIds
    ) {
        String logCtx = CLASS_NAME + '.getMissedCheckpoints';
        System.debug(LoggingLevel.INFO, logCtx + ' >> START startDate=' + startDate + ' endDate=' + endDate
            + ' zoneIds=' + zoneIds + ' ambassadorIds=' + ambassadorIds);

        String endpoint = buildBase('/reports/missed-checkpoints', startDate, endDate);
        endpoint = appendListParam(endpoint, 'zone_id',       zoneIds);
        endpoint = appendListParam(endpoint, 'ambassador_id', ambassadorIds);

        try {
            Map<String, Object> result = GcpBaseService.parse(GcpBaseService.send(endpoint));
            System.debug(LoggingLevel.INFO, logCtx + ' >> END success=' + result.get('success'));
            return result;
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, logCtx + ' >> Exception: ' + e.getMessage() + '\n' + e.getStackTraceString());
            return new Map<String, Object>{ 'success' => false, 'message' => e.getMessage() };
        }
    }

    // =========================
    // CHECKPOINT TIMING
    // =========================

    @AuraEnabled
    public static Map<String, Object> getCheckpointTiming(
        String       startDate,
        String       endDate,
        List<String> zoneIds,
        List<String> ambassadorIds
    ) {
        String logCtx = CLASS_NAME + '.getCheckpointTiming';
        System.debug(LoggingLevel.INFO, logCtx + ' >> START startDate=' + startDate + ' endDate=' + endDate
            + ' zoneIds=' + zoneIds + ' ambassadorIds=' + ambassadorIds);

        String endpoint = buildBase('/reports/checkpoint-timing', startDate, endDate);
        endpoint = appendListParam(endpoint, 'zone_id',       zoneIds);
        endpoint = appendListParam(endpoint, 'ambassador_id', ambassadorIds);

        try {
            Map<String, Object> result = GcpBaseService.parse(GcpBaseService.send(endpoint));
            System.debug(LoggingLevel.INFO, logCtx + ' >> END success=' + result.get('success'));
            return result;
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, logCtx + ' >> Exception: ' + e.getMessage() + '\n' + e.getStackTraceString());
            return new Map<String, Object>{ 'success' => false, 'message' => e.getMessage() };
        }
    }

    // =========================
    // COVERAGE REPORT
    // =========================

    @AuraEnabled
    public static Map<String, Object> getCoverageReports(
        String       startDate,
        String       endDate,
        List<String> zoneIds,
        List<String> ambassadorIds
    ) {
        String logCtx = CLASS_NAME + '.getCoverageReports';
        System.debug(LoggingLevel.INFO, logCtx + ' >> START startDate=' + startDate + ' endDate=' + endDate
            + ' zoneIds=' + zoneIds + ' ambassadorIds=' + ambassadorIds);

        String endpoint = buildBase('/reports/coverage', startDate, endDate);
        endpoint = appendListParam(endpoint, 'ambassador_id', ambassadorIds);
        endpoint = appendListParam(endpoint, 'zone_id',       zoneIds);

        try {
            Map<String, Object> result = GcpBaseService.parse(GcpBaseService.send(endpoint));
            System.debug(LoggingLevel.INFO, logCtx + ' >> END success=' + result.get('success'));
            return result;
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, logCtx + ' >> Exception: ' + e.getMessage() + '\n' + e.getStackTraceString());
            return new Map<String, Object>{ 'success' => false, 'message' => e.getMessage() };
        }
    }

    // =========================
    // TEAM DASHBOARD
    // =========================

    @AuraEnabled
    public static Map<String, Object> getTeamDashboard(
        List<String> teamIds,
        String       startDate,
        String       endDate,
        String       compareTo
    ) {
        String logCtx = CLASS_NAME + '.getTeamDashboard';
        System.debug(LoggingLevel.INFO, logCtx + ' >> START teamIds=' + teamIds
            + ' startDate=' + startDate + ' endDate=' + endDate + ' compareTo=' + compareTo);

        String endpoint = '/reports/team-dashboard?';

        if (teamIds != null && !teamIds.isEmpty()) {
            endpoint += 'team_id=' +
                EncodingUtil.urlEncode(String.join(teamIds, ','), 'UTF-8') + '&';
            System.debug(LoggingLevel.FINE, logCtx + ' >> team_id param added: ' + teamIds);
        }

        endpoint += 'start_date=' + EncodingUtil.urlEncode(startDate, 'UTF-8')
                  + '&end_date='  + EncodingUtil.urlEncode(endDate,   'UTF-8')
                  + '&compare_to='+ EncodingUtil.urlEncode(compareTo, 'UTF-8');

        try {
            Map<String, Object> result = GcpBaseService.parse(GcpBaseService.send(endpoint));
            System.debug(LoggingLevel.INFO, logCtx + ' >> END success=' + result.get('success'));
            return result;
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, logCtx + ' >> Exception: ' + e.getMessage() + '\n' + e.getStackTraceString());
            return new Map<String, Object>{ 'success' => false, 'message' => e.getMessage() };
        }
    }

    // =========================
    // BOUNDARY BREACH
    // =========================

    @AuraEnabled
    public static Map<String, Object> getBoundaryBreachReport(
        String       startDate,
        String       endDate,
        List<String> zoneIds,
        List<String> ambassadorIds
    ) {
        String logCtx = CLASS_NAME + '.getBoundaryBreachReport';
        System.debug(LoggingLevel.INFO, logCtx + ' >> START startDate=' + startDate + ' endDate=' + endDate
            + ' zoneIds=' + zoneIds + ' ambassadorIds=' + ambassadorIds);

        String endpoint = buildBase('/reports/boundary-breaches', startDate, endDate);
        endpoint = appendListParam(endpoint, 'zone_id',       zoneIds);
        endpoint = appendListParam(endpoint, 'ambassador_id', ambassadorIds);

        try {
            Map<String, Object> result = GcpBaseService.parse(GcpBaseService.send(endpoint));
            System.debug(LoggingLevel.INFO, logCtx + ' >> END success=' + result.get('success'));
            return result;
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, logCtx + ' >> Exception: ' + e.getMessage() + '\n' + e.getStackTraceString());
            return new Map<String, Object>{ 'success' => false, 'message' => e.getMessage() };
        }
    }

    // =========================
    // AMBASSADOR ACTIVITY
    // =========================

    @AuraEnabled
    public static Map<String, Object> getAmbassadorActivityReport(
        String       startDate,
        String       endDate,
        List<String> ambassadorIds
    ) {
        String logCtx = CLASS_NAME + '.getAmbassadorActivityReport';
        System.debug(LoggingLevel.INFO, logCtx + ' >> START startDate=' + startDate + ' endDate=' + endDate
            + ' ambassadorIds=' + ambassadorIds);

        String endpoint = buildBase('/reports/ambassador-activity', startDate, endDate);
        endpoint = appendListParam(endpoint, 'ambassador_id', ambassadorIds);

        try {
            Map<String, Object> result = GcpBaseService.parse(GcpBaseService.send(endpoint));
            System.debug(LoggingLevel.INFO, logCtx + ' >> END success=' + result.get('success'));
            return result;
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, logCtx + ' >> Exception: ' + e.getMessage() + '\n' + e.getStackTraceString());
            return new Map<String, Object>{ 'success' => false, 'message' => e.getMessage() };
        }
    }

    // =========================
    // SHIFT STATUS
    // =========================

    @AuraEnabled
    public static Map<String, Object> getAmbassadorInOutReport(
        String       startDate,
        String       endDate,
        List<String> ambassadorIds
    ) {
        String logCtx = CLASS_NAME + '.getAmbassadorInOutReport';
        System.debug(LoggingLevel.INFO, logCtx + ' >> START startDate=' + startDate + ' endDate=' + endDate
            + ' ambassadorIds=' + ambassadorIds);

        String endpoint = buildBase('/reports/ambassador-shift-status', startDate, endDate);
        endpoint = appendListParam(endpoint, 'ambassador_id', ambassadorIds);

        try {
            Map<String, Object> result = GcpBaseService.parse(GcpBaseService.send(endpoint));
            System.debug(LoggingLevel.INFO, logCtx + ' >> END success=' + result.get('success'));
            return result;
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, logCtx + ' >> Exception: ' + e.getMessage() + '\n' + e.getStackTraceString());
            return new Map<String, Object>{ 'success' => false, 'message' => e.getMessage() };
        }
    }

    // =========================
    // IDLE REPORT
    // =========================

    @AuraEnabled
    public static Map<String, Object> getAmbassadorIdleReport(
        String       startDate,
        String       endDate,
        List<String> ambassadorIds
    ) {
        String logCtx = CLASS_NAME + '.getAmbassadorIdleReport';
        System.debug(LoggingLevel.INFO, logCtx + ' >> START startDate=' + startDate + ' endDate=' + endDate
            + ' ambassadorIds=' + ambassadorIds);

        String endpoint = buildBase('/reports/ambassador-idle', startDate, endDate);
        endpoint = appendListParam(endpoint, 'ambassador_id', ambassadorIds);

        try {
            Map<String, Object> result = GcpBaseService.parse(GcpBaseService.send(endpoint));
            System.debug(LoggingLevel.INFO, logCtx + ' >> END success=' + result.get('success'));
            return result;
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, logCtx + ' >> Exception: ' + e.getMessage() + '\n' + e.getStackTraceString());
            return new Map<String, Object>{ 'success' => false, 'message' => e.getMessage() };
        }
    }
}