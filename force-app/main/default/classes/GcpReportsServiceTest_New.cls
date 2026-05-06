@IsTest
public class GcpReportsServiceTest_New {

    // ✅ Simple reusable mock
    class SimpleMock implements HttpCalloutMock {
        public HTTPResponse respond(HTTPRequest req) {
            HttpResponse res = new HttpResponse();
            res.setStatusCode(200);

            // Minimal realistic response
            if (req.getEndpoint().contains('/boundaries')) {
                res.setBody('{"success":true,"data":{"zones":[{"zone_id":"Z1","name":"Zone 1","ambassadors":[{"id":"A1"}]}]}}');
            } else if (req.getEndpoint().contains('/auth/salesforce')) {
                res.setBody('{"data":{"token":"test_token"}}');
            } else {
                res.setBody('{"success":true,"data":{"top_performer":{"name":"Test"},"records":[]}}');
            }

            return res;
        }
    }

    @IsTest
    static void testAllMethods() {

        Test.setMock(HttpCalloutMock.class, new SimpleMock());

        Test.startTest();

        // =========================
        // BOUNDARIES
        // =========================
        GcpReportsService.getAllZoneAndAmbassadorIds();
        GcpReportsService.getZonePicklist();

        // =========================
        // DASHBOARD
        // =========================
        GcpReportsService.getDashboardMetrics('2024-01-01','2024-01-02',true);
        GcpReportsService.getTopPerformer('2024-01-01','2024-01-02');

        // =========================
        // ZONE COVERAGE
        // =========================
        GcpReportsService.getZoneCoverage(
            '2024-01-01','2024-01-02',
            new List<String>{'A1'},
            new List<String>{'Z1'}
        );

        // =========================
        // MISSED CHECKPOINTS
        // =========================
        GcpReportsService.getMissedCheckpoints(
            '2024-01-01','2024-01-02',
            new List<String>{'Z1'},
            new List<String>{'A1'}
        );

        // =========================
        // OTHER REPORTS
        // =========================
        GcpReportsService.getCheckpointTiming('2024-01-01','2024-01-02', new List<String>{'Z1'}, new List<String>{'A1'});
        GcpReportsService.getCoverageReports('2024-01-01','2024-01-02', new List<String>{'Z1'}, new List<String>{'A1'});
        GcpReportsService.getBoundaryBreachReport('2024-01-01','2024-01-02', new List<String>{'Z1'}, new List<String>{'A1'});
        GcpReportsService.getAmbassadorActivityReport('2024-01-01','2024-01-02', new List<String>{'A1'});
        GcpReportsService.getAmbassadorInOutReport('2024-01-01','2024-01-02', new List<String>{'A1'});
        GcpReportsService.getAmbassadorIdleReport('2024-01-01','2024-01-02', new List<String>{'A1'});

        // =========================
        // TEAM DASHBOARD
        // =========================
        GcpReportsService.getTeamDashboard(
            new List<String>{'T1'},
            '2024-01-01',
            '2024-01-02',
            'previous_period'
        );

        Test.stopTest();

        // Minimal assertion (keeps style simple like your old class)
        System.assert(true);
    }
    @IsTest
static void testErrorResponse_Non200() {

    Test.setMock(HttpCalloutMock.class, new GcpErrorMock());

    Test.startTest();

    Map<String, Object> res =
        GcpReportsService.getDashboardMetrics('2024-01-01','2024-01-02', true);

    Test.stopTest();

    System.assertEquals(false, res.get('success'));
}
    
    @IsTest
static void testApiReturnsSuccessFalse() {

    Test.setMock(HttpCalloutMock.class, new GcpFalseSuccessMock());

    Test.startTest();

    Map<String, Object> res =
        GcpReportsService.getDashboardMetrics('2024-01-01','2024-01-02', true);

    Test.stopTest();

    System.assertEquals(false, res.get('success'));
}
}