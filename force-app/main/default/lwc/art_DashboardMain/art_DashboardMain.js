import { LightningElement, track } from 'lwc';
import getDashboardMetrics          from '@salesforce/apex/GcpReportsService.getDashboardMetrics';
import getTeamDashboard             from '@salesforce/apex/GcpReportsService.getTeamDashboard';
import getZoneCoverage              from '@salesforce/apex/GcpReportsService.getZoneCoverage';
import getMissedCheckpoints         from '@salesforce/apex/GcpReportsService.getMissedCheckpoints';
import getCoverageReports           from '@salesforce/apex/GcpReportsService.getCoverageReports';
import getCheckpointTiming          from '@salesforce/apex/GcpReportsService.getCheckpointTiming';
import getBoundaryBreachReport      from '@salesforce/apex/GcpReportsService.getBoundaryBreachReport';
import getAmbassadorActivityReport  from '@salesforce/apex/GcpReportsService.getAmbassadorActivityReport';
import getAmbassadorInOutReport     from '@salesforce/apex/GcpReportsService.getAmbassadorInOutReport';
import getAmbassadorIdleReport      from '@salesforce/apex/GcpReportsService.getAmbassadorIdleReport';

export default class Art_DashboardMain extends LightningElement {

    // ─── State ───────────────────────────────────────────────────────────────
    @track isloading        = false;
    @track activeTab        = 'dashboard';
    @track hasUserSetDate   = false;

    // ─── Report data ─────────────────────────────────────────────────────────
    @track dashboardData;
    @track teamData;
    @track zoneCoverageData;
    @track missedData;
    @track checkpointTimingData;
    @track coverageData;
    @track boundaryBreachData;
    @track ambassadorData;
    @track reportData;
    @track idleData;

    // ─── Error state ─────────────────────────────────────────────────────────
    @track error;
    @track coverageError;
    @track zoneError;
    @track idleError;

    // ─── Filter params ───────────────────────────────────────────────────────
    startDate;
    endDate;
    teamIds        = [];
    zoneIds        = [];
    ambassadorIds  = [];

    // =========================================================================
    // LIFECYCLE
    // =========================================================================
    connectedCallback() {
        const todayUTC     = this.formatDate(new Date());
        const yesterdayUTC = this.formatDate(this._offsetDate(-1));

        // Dashboard default = today; all other tabs = yesterday
        this.startDate = this.activeTab === 'dashboard' ? todayUTC : yesterdayUTC;
        this.endDate   = this.activeTab === 'dashboard' ? todayUTC : yesterdayUTC;

        this.loadActiveTabData();
    }

    // =========================================================================
    // HANDLERS
    // =========================================================================
    handleTabClick(event) {
        const newTab = event.currentTarget.dataset.tab;
        if (this.activeTab === newTab) return;

        this.activeTab = newTab;

        // Only reset dates if user never touched the date filter
        if (!this.hasUserSetDate) {
            const todayUTC     = this.formatDate(new Date());
            const yesterdayUTC = this.formatDate(this._offsetDate(-1));
            this.startDate = newTab === 'dashboard' ? todayUTC : yesterdayUTC;
            this.endDate   = newTab === 'dashboard' ? todayUTC : yesterdayUTC;
        }

        this.loadActiveTabData();
    }

    handleApplyFilter(event) {
        const { startDate, endDate, teamIds, zoneIds, ambassadorIds } = event.detail;

        this.startDate    = startDate;
        this.endDate      = endDate;
        this.teamIds      = teamIds      || [];
        this.zoneIds      = zoneIds      || [];
        this.ambassadorIds= ambassadorIds|| [];
        this.hasUserSetDate = true;

        console.log('🔥 Filters Applied:', JSON.stringify({ startDate, endDate, teamIds, zoneIds, ambassadorIds }));

        this.loadActiveTabData();
    }

    handleRefresh() {
        console.log('🔄 Refresh clicked for tab:', this.activeTab);
        this.loadActiveTabData();
    }

    // =========================================================================
    // ROUTING
    // =========================================================================
    loadActiveTabData() {
        const loaders = {
            dashboard   : () => this.loadDashboard(),
            top         : () => this.loadDashboard(),
            team        : () => this.loadTeamDashboard(),
            zone        : () => this.loadZoneCoverage(),
            missed      : () => this.loadMissedCheckpoints(),
            coverage    : () => this.loadCoverageReports(),
            timing      : () => this.loadCheckpointTiming(),
            boundary    : () => this.loadBoundaryBreachReport(),
            ambactivity : () => this.loadAmbassadorActivityReport(),
            ambashiftin : () => this.loadAmbassadorInOutReport(),
            ambidle     : () => this.loadIdleReports()
        };

        const loader = loaders[this.activeTab];
        if (loader) {
            loader();
        } else {
            console.warn('Unknown tab:', this.activeTab);
        }
    }

    // =========================================================================
    // GENERIC API HELPER
    // =========================================================================
    /**
     * @param {Promise}  promise         - Apex call promise
     * @param {Function} successCallback - receives res.data on success
     * @param {Function} [errorCallback] - receives error message on failure
     */
    handleApi(promise, successCallback, errorCallback) {
        this.isloading = true;

        promise
            .then(res => {
                if (res && res.success) {
                    successCallback(res.data);
                } else {
                    const msg = (res && res.message) || 'Unknown error';
                    console.error('API returned success=false:', msg);
                    if (errorCallback) errorCallback(msg);
                }
            })
            .catch(err => {
                const msg = err?.body?.message || err?.message || 'Unknown error';
                console.error('API callout error:', msg);
                if (errorCallback) errorCallback(msg);
            })
            .finally(() => {
                this.isloading = false;
            });
    }

    // =========================================================================
    // API CALLS — all use handleApi for consistency
    // =========================================================================
    loadDashboard() {
        this.handleApi(
            getDashboardMetrics({
                startDate   : this.startDate,
                endDate     : this.endDate,
                bypassCache : true
            }),
            data => { this.dashboardData = data; },
            msg  => { this.error = msg; }
        );
    }

    loadTeamDashboard() {
        this.handleApi(
            getTeamDashboard({
                teamIds   : this.teamIds,
                startDate : this.startDate,
                endDate   : this.endDate,
                compareTo : 'previous_period'
            }),
            data => { this.teamData = data; },
            msg  => { this.error = msg; }
        );
    }

    loadZoneCoverage() {
        this.zoneError = null;
        this.handleApi(
            getZoneCoverage({
                startDate    : this.startDate,
                endDate      : this.endDate,
                zoneIds      : this.zoneIds,
                ambassadorIds: this.ambassadorIds
            }),
            data => {
                this.zoneCoverageData = data;
                console.log('zoneCoverageData =>', JSON.stringify(data));
            },
            msg  => { this.zoneError = msg; }
        );
    }

    loadMissedCheckpoints() {
        this.error = null;
        this.handleApi(
            getMissedCheckpoints({
                startDate    : this.startDate,
                endDate      : this.endDate,
                zoneIds      : this.zoneIds,
                ambassadorIds: this.ambassadorIds
            }),
            data => { this.missedData = data; },
            msg  => { this.error = msg; }
        );
    }

    loadCoverageReports() {
        this.coverageError = null;
        this.handleApi(
            getCoverageReports({
                startDate    : this.startDate,
                endDate      : this.endDate,
                zoneIds      : this.zoneIds,
                ambassadorIds: this.ambassadorIds
            }),
            data => { this.coverageData = data; },
            msg  => { this.coverageError = msg; }
        );
    }

    loadCheckpointTiming() {
        this.error = null;
        this.handleApi(
            getCheckpointTiming({
                startDate    : this.startDate,
                endDate      : this.endDate,
                zoneIds      : this.zoneIds,
                ambassadorIds: this.ambassadorIds
            }),
            data => { this.checkpointTimingData = data; },
            msg  => { this.error = msg; }
        );
    }

     loadBoundaryBreachReport() {
    this.isloading = true;
    this.error = null;

    getBoundaryBreachReport({
        startDate: this.startDate,
        endDate: this.endDate,
        ambassadorIds: this.ambassadorIds
    })
    .then(res => {
        if (res.success) {
            this.boundaryBreachData = res;
        } else {
            this.error = res.message;
        }
    })
    .catch(err => {
        console.error(err);
        this.error = 'Error loading boundary breach report';
    })
    .finally(() => this.isloading = false);
}

    loadAmbassadorActivityReport() {
        this.error = null;
        this.handleApi(
            getAmbassadorActivityReport({
                startDate    : this.startDate,
                endDate      : this.endDate,
                ambassadorIds: this.ambassadorIds
            }),
            data => { this.ambassadorData = data; },
            msg  => { this.error = msg; }
        );
    }

    loadAmbassadorInOutReport() {
        this.error = null;
        this.handleApi(
            getAmbassadorInOutReport({
                startDate    : this.startDate,
                endDate      : this.endDate,
                ambassadorIds: this.ambassadorIds
            }),
            data => { this.reportData = data; },
            msg  => { this.error = msg; }
        );
    }

    loadIdleReports() {
        this.idleError = null;
        this.handleApi(
            getAmbassadorIdleReport({
                startDate    : this.startDate,
                endDate      : this.endDate,
                ambassadorIds: this.ambassadorIds
            }),
            data => { this.idleData = data; },
            msg  => { this.idleError = msg; }
        );
    }

    // =========================================================================
    // TAB VISIBILITY GETTERS
    // =========================================================================
    get isDashboard() { return this.activeTab === 'dashboard';   }
    get isTop()       { return this.activeTab === 'top';         }
    get isMissed()    { return this.activeTab === 'missed';      }
    get isCoverage()  { return this.activeTab === 'coverage';    }
    get isZone()      { return this.activeTab === 'zone';        }
    get isTeam()      { return this.activeTab === 'team';        }
    get isTiming()    { return this.activeTab === 'timing';      }
    get isBoundary()  { return this.activeTab === 'boundary';    }
    get isActivity()  { return this.activeTab === 'ambactivity'; }
    get isShift()     { return this.activeTab === 'ambashiftin'; }
    get isIdle()      { return this.activeTab === 'ambidle';     }

    // =========================================================================
    // TAB CSS CLASS GETTERS
    // =========================================================================
    getClass(tab) {
        return `tab-item${this.activeTab === tab ? ' active' : ''}`;
    }

    get dashboardClass() { return this.getClass('dashboard');   }
    get topClass()       { return this.getClass('top');         }
    get missedClass()    { return this.getClass('missed');      }
    get coverageClass()  { return this.getClass('coverage');    }
    get zoneClass()      { return this.getClass('zone');        }
    get teamClass()      { return this.getClass('team');        }
    get timingClass()    { return this.getClass('timing');      }
    get boundaryClass()  { return this.getClass('boundary');    }
    get activityClass()  { return this.getClass('ambactivity'); }
    get shiftClass()     { return this.getClass('ambashiftin'); }
    get idleClass()      { return this.getClass('ambidle');     }

    // =========================================================================
    // FILTER CONFIG PER TAB
    // =========================================================================
    get filterConfig() {
        const dateOnly     = { showStartDate: true, showEndDate: true, showTeam: false, showZone: false, showAmbassador: false };
        const teamOnly     = { showStartDate: true, showEndDate: true, showTeam: true,  showZone: false, showAmbassador: false };
        const allFilters   = { showStartDate: true, showEndDate: true, showTeam: true,  showZone: true,  showAmbassador: true  };
        const noZone       = { showStartDate: true, showEndDate: true, showTeam: true,  showZone: false, showAmbassador: true  };

        const configMap = {
            dashboard   : dateOnly,
            top         : dateOnly,
            team        : teamOnly,
            zone        : allFilters,
            missed      : allFilters,
            coverage    : allFilters,
            timing      : allFilters,
            boundary    : noZone,
            ambactivity : noZone,
            ambashiftin : noZone,
            ambidle     : noZone
        };

        return configMap[this.activeTab] || {};
    }

    // =========================================================================
    // PRIVATE UTILS
    // =========================================================================
    formatDate(date) {
        return date.toISOString().split('T')[0];
    }

    _offsetDate(days) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        return d;
    }
}