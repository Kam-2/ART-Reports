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

@track bypassCache = false;
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

    cache = new Map();

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

    // 🚨 enable bypass mode
    this.bypassCache = true;

    // clear frontend cache
    this.cache.clear();

    // reset filters UI
    const filterCmp = this.template.querySelector('c-dashboard-filters');
    if (filterCmp) {
        filterCmp.resetFilters();
    }

    // reload fresh data (NO CACHE)
    //this.loadActiveTabData();

    // reset flag AFTER execution
    setTimeout(() => {
        this.bypassCache = false;
    }, 0);
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
    handleApi(cacheKey,promise, successCallback, errorCallback) {

         // 🚨 bypass ALL cache when refresh is triggered
    if (!this.bypassCache && this.cache.has(cacheKey)) {
        console.log('Serving from frontend cache:', cacheKey);
        successCallback(this.cache.get(cacheKey));
        return;
    }
        this.isloading = true;

        promise
            .then(res => {
                if (res && res.success) {
                    // ✅ store in frontend cache

                // ❌ do NOT store cache during refresh
                if (!this.bypassCache) {
                    this.cache.set(cacheKey, res.data);
                }                    successCallback(res.data);
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

    buildKey(type) {
    const datePart = `${this.startDate}-${this.endDate}`;
    const ambPart  = this.ambassadorIds?.join(',') || 'all';
    const zonePart = this.zoneIds?.join(',') || 'all';
    const teamPart = this.teamIds?.join(',') || 'all';

        const tab = this.activeTab; // 🔥 IMPORTANT


     switch (type) {
        case 'date':
            return `${tab}-date-${datePart}`;

        case 'amb':
            return `${tab}-amb-${datePart}-${ambPart}`;

        case 'zoneAmb':
            return `${tab}-zoneAmb-${datePart}-${zonePart}-${ambPart}`;

        case 'team':
            return `${tab}-team-${datePart}-${teamPart}`;

        default:
            return `${tab}-default-${datePart}`;
    }
}

    // =========================================================================
    // API CALLS — all use handleApi for consistency
    // =========================================================================
    loadDashboard() {
const key = this.buildKey('date');
        this.handleApi(        key,

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
        const key = this.buildKey('team');
        this.handleApi(key,
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
const key = this.buildKey('zoneAmb');
        this.zoneError = null;
        this.handleApi(key,
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

const key = this.buildKey('zoneAmb');
        this.error = null;
        this.handleApi(key,
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
const key = this.buildKey('zoneAmb');
        this.coverageError = null;
        this.handleApi(key,
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
        const key = this.buildKey('zoneAmb');
        this.error = null;
        this.handleApi(key,
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
        const key = this.buildKey('amb');
        this.error = null;
        this.handleApi(key,
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
                const key = this.buildKey('amb');

        this.error = null;
        this.handleApi(key,
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
                const key = this.buildKey('amb');

        this.idleError = null;
        this.handleApi(key,
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