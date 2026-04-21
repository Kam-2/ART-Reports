import { LightningElement, track, wire, api } from 'lwc';
import getTeamPicklist from '@salesforce/apex/DashboardFilterController.getTeams';
import getAmbassadors from '@salesforce/apex/DashboardFilterController.getAmbassadors';
import getZonePicklistFromAPI from '@salesforce/apex/GcpReportsService.getZonePicklist';

export default class DashboardFilters extends LightningElement {
    _activeTab;

    isInitialized = false;

    isZoneUserChanged = false;
    isAmbUserChanged = false;
    @api config = {};
    @track startDate;
    @track endDate;
    @track teamIds = [];
    @track zoneIds = [];
    @track ambassadorIds = [];
    selectedZoneId;
    @track options = [];
    @track zoneOptions = [];
    @track ambassadorOptions = [];
    //filteredAmbassadorOptions=[];
    teamAmbassadorMap = {};
    allAmbassadorsMap = {};
    showTeamDropdown = false;
    showZoneDropdown = false;
    showAmbDropdown = false;
    @track minDate;
    @track maxDate;


     get activeTab() {
        return this._activeTab;
    }

     get startDateValue() {
        return this.startDate;
    }

    get endDateValue() {
        return this.endDate;
    }

    getUTCDate(date = new Date()) {
        return date.toISOString().split('T')[0];
    }

       @api
    set activeTab(value) {
        console.log('🔥 activeTab received:', value);

        const isFirstLoad = !this.isInitialized;

        this._activeTab = value;

        // ✅ ONLY set default dates on first load
        if (isFirstLoad) {
            this.applyTabDefaultDates(value);
        }
    }

    setDateRangeLimits() {
        const today = new Date();

        // max = today
        this.maxDate = this.formatDate(today);

        // min = 60 days back
        const past60 = new Date();
        past60.setDate(today.getDate() - 60);
        this.minDate = this.formatDate(past60);
    }

    formatDate(date) {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }
   
    applyTabDefaultDates(tab) {

        const today = new Date();
        const todayUTC = today.toISOString().split('T')[0];

        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);
        const yesterdayUTC = yesterday.toISOString().split('T')[0];

        if (tab === 'dashboard') {
            this.startDate = todayUTC;
            this.endDate = todayUTC;
        } else {
            this.startDate = yesterdayUTC;
            this.endDate = yesterdayUTC;
        }
    }

    toggleTeamDropdown(event) {
        event.stopPropagation();

        this.showTeamDropdown = !this.showTeamDropdown;
        this.showZoneDropdown = false;
        this.showAmbDropdown = false;
    }

    toggleZoneDropdown(event) {
        event.stopPropagation();

        this.showZoneDropdown = !this.showZoneDropdown;
        this.showTeamDropdown = false;
        this.showAmbDropdown = false;
    }

    toggleAmbDropdown(event) {
        event.stopPropagation();

        this.showAmbDropdown = !this.showAmbDropdown;
        this.showTeamDropdown = false;
        this.showZoneDropdown = false;
    }

    stopPropagation(event) {
        event.stopPropagation();
    }
    get isCoverageTab() {
        return this.activeTab === 'coverage';
    }



    loadTeams() {
        getTeamPicklist()
            .then(result => {
                this.options = result;  // ✅ NO mapping
                console.log('this.options', JSON.stringify(this.options));
            })
            .catch(error => {
                console.error('Team load error', error);
            });
    }

    connectedCallback() {
        this.setDateRangeLimits();   // ✅ ADD THIS


        this.loadZones();
        this.loadTeams();

        // Check if we are in the coverage tab
        if (this.isCoverageTab) {
            // Load zones and select all by default
            this.loadZonesForCoverage();
            // Load ambassadors and select all by default
        }
        // document.addEventListener('click', this.handleOutsideClick);

        document.addEventListener('click', this.handleOutsideClick);
    }

    handleOutsideClick = (event) => {

        // check if click is inside ANY filter block
        const isInsideFilter = event.target.closest('[data-filter]');

        if (!isInsideFilter) {
            // 🔥 clicked outside filters → close all
            this.showTeamDropdown = false;
            this.showZoneDropdown = false;
            this.showAmbDropdown = false;
        }
    };
    get teamOptionsWithCheck() {
        return this.options.map(opt => ({
            ...opt,
            checked: this.teamIds.includes(opt.value)
        }));
    }

    get zoneOptionsWithCheck() {
        return this.zoneOptions.map(opt => ({
            ...opt,
            checked: this.zoneIds.includes(opt.value)
        }));
    }
    get ambassadorOptionsWithCheck() {
        return this.filteredAmbassadorOptions.map(opt => ({
            ...opt,
            checked: this.ambassadorIds.includes(opt.value)
        }));
    }
   

 
    loadZones() {
        getZonePicklistFromAPI()
            .then(result => {
                this.zoneOptions = result;
                // 🔥 Extract ALL zone IDs
                //this.zoneIds = result.map(z => z.value);
                //console.log('allzoneids'+this.zoneIds);

            })
            .catch(error => {
                console.error('Zone load error', error);
            });
    }

    @wire(getAmbassadors)
    wiredAmbassadors({ data }) {
        if (data) this.ambassadorOptions = data.map(a => ({ label: a.Name, value: a.Id, team: a.d360_team__c }));

        // ✅ For Coverage Reports → select all ambassadors by default
        if (this.isCoverageTab) {
            this.ambassadorIds = this.ambassadorOptions.map(a => a.value);

            console.log('Coverage default ambassadorIds:', this.ambassadorIds);

            // Optional: notify parent immediately with default coverage filter
            this.notifyParent();
        }
    }



    handleStart(e) {
        this.isInitialized = true;

        const newStart = e.target.value;
        const end = this.endDate;

        this.startDate = newStart;

        const startInput = e.target;
        const endInput = this.template.querySelector('.endDate');

        // reset first
        startInput.setCustomValidity('');
        if (endInput) endInput.setCustomValidity('');

        // ❌ INVALID
        if (end && newStart > end) {
            startInput.setCustomValidity('Start date cannot be greater than End date');
        }

        startInput.reportValidity();
        if (endInput) endInput.reportValidity();
    }

    handleEnd(e) {
        this.isInitialized = true;

        const newEnd = e.target.value;
        const start = this.startDate;

        this.endDate = newEnd;

        const endInput = e.target;
        const startInput = this.template.querySelector('.startDate');

        // reset first
        endInput.setCustomValidity('');
        if (startInput) startInput.setCustomValidity('');

        // ❌ INVALID
        if (start && newEnd < start) {
            endInput.setCustomValidity('End date cannot be earlier than Start date');
        }

        endInput.reportValidity();
        if (startInput) startInput.reportValidity();
    }

    handleZoneSelect(event) {
        const id = event.currentTarget.dataset.id;
        this.isZoneUserChanged = true; // ✅ IMPORTANT

        this.zoneIds = this.toggle(this.zoneIds, id);
        console.log(' this.zoneIds' + this.zoneIds);
    }

    handleAmbSelect(event) {
        const id = event.currentTarget.dataset.id;
        this.isAmbUserChanged = true; // ✅ IMPORTANT

        this.ambassadorIds = this.toggle(this.ambassadorIds, id);
        console.log(' this.ambassadorIds' + this.ambassadorIds);
    }



    handleTeamSelect(event) {
        const id = event.currentTarget.dataset.id;

        this.teamIds = this.toggle(this.teamIds, id);

        this.isAmbUserChanged = false;

        // ✅ ONLY auto-select ambassadors for NON-team tabs
        if (this.activeTab !== 'team') {
            const filtered = this.filteredAmbassadorOptions;
            this.ambassadorIds = filtered.map(a => a.value);

            console.log('🔥 Auto-selected ambassadors:', JSON.stringify(this.ambassadorIds));
        } else {
            // ✅ Team tab → DO NOT touch ambassadorIds
            this.ambassadorIds = [];
        }
    }
    toggle(list, value) {
        return list.includes(value)
            ? list.filter(v => v !== value)
            : [...list, value];
    }


    get filteredAmbassadorOptions() {
        if (!this.teamIds.length) {
            return this.ambassadorOptions; // show all if no team selected
        }

        return this.ambassadorOptions.filter(opt =>
            this.teamIds.includes(opt.team)
        );
    }


    get teamSummary() {
        return this.getSummary(this.options, this.teamIds);
    }

    get zoneSummary() {
        return this.getSummary(this.zoneOptions, this.zoneIds);
    }

    get ambSummary() {
        return this.getSummary(this.ambassadorOptions, this.ambassadorIds);
    }

    getSummary(allOptions, selectedIds) {
        //console.log('allOptions'+JSON.stringify(allOptions));
        if (!selectedIds.length) return 'All';

        const selected = allOptions.filter(o => selectedIds.includes(o.value));

        if (selected.length <= 2) {
            return selected.map(s => s.label).join(', ');
        }

        return `${selected.length} selected`;
    }

    disconnectedCallback() {
        document.removeEventListener('click', this.handleOutsideClick);
    }


    notifyParent() {

        if (this.zoneIds?.length && this.ambassadorIds?.length) {

            this.isInitialized = true;

            // ✅ DO NOT override dashboard dates
            if (this.activeTab !== 'dashboard') {
                if (!this.startDate) {
                    this.startDate = new Date().toISOString().split('T')[0];
                }
                if (!this.endDate) {
                    this.endDate = this.startDate;
                }
            }

            this.dispatchEvent(new CustomEvent('filterchange', {
                detail: {
                    startDate: this.startDate,
                    endDate: this.endDate,
                    teamIds: [],
                    zoneIds: this.zoneIds,
                    ambassadorIds: this.ambassadorIds
                }
            }));

            console.log('🚀 Initial API Triggered');
        }
    }

    applyFilters() {

        // STOP if date invalid
        if (!this.startDate || !this.endDate) {
            return;
        }

        if (this.endDate < this.startDate) {
            const endInput = this.template.querySelector('.endDate');

            if (endInput) {
                endInput.setCustomValidity('End date cannot be earlier than Start date');
                endInput.reportValidity();
            }

            return; //STOP APPLY
        }

        // ✅ Zones
        let finalZoneIds;

        if (!this.isZoneUserChanged || this.zoneIds.length === 0) {
            finalZoneIds = this.zoneOptions.map(z => z.value);
        } else {
            finalZoneIds = this.zoneIds;
        }

        // ✅ Ambassadors
        let finalAmbassadorIds = this.ambassadorIds;

        const isTeamTab = this.activeTab === 'team';

        this.dispatchEvent(new CustomEvent('filterchange', {
            detail: {
                startDate: this.startDate,
                endDate: this.endDate,
                teamIds: this.teamIds,
                zoneIds: finalZoneIds,
                ambassadorIds: isTeamTab ? [] : finalAmbassadorIds
            }
        }));

        console.log('ambassadorIdnewafter', JSON.stringify(this.ambassadorIds));
        console.log('zoneId', JSON.stringify(this.zoneIds));
        console.log('teamId', JSON.stringify(this.teamIds));

    }

    get noAmbassadorsFound() {
        return this.teamIds.length && this.filteredAmbassadorOptions.length === 0;
    }
    resetFilters() {

        this.applyTabDefaultDates(this.activeTab); // ✅ correct

        this.teamIds = [];
        this.zoneIds = [];
        this.ambassadorIds = [];

        this.isInitialized = false;
        this.isZoneUserChanged = false;
        this.isAmbUserChanged = false;

        // 🔥 CLEAR DATE VALIDATION ON BOTH FIELDS
        const startInput = this.template.querySelector('.startDate');
        const endInput = this.template.querySelector('.endDate');

        if (startInput) {
            startInput.setCustomValidity('');
            startInput.reportValidity();
        }

        if (endInput) {
            endInput.setCustomValidity('');
            endInput.reportValidity();
        }
        this.dispatchEvent(new CustomEvent('filterchange', {
            detail: {
                startDate: this.startDate,
                endDate: this.endDate,
                teamIds: [],
                zoneIds: [],
                ambassadorIds: []
            }
        }));
    }
}