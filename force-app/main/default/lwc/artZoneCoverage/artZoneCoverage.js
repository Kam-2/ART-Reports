import { LightningElement, api, track } from 'lwc';

export default class ArtZoneCoverage extends LightningElement {

    @track tableData      = [];
    @track allData        = [];

    @api isLoading = false;
    @api error;

    @track totalZones   = 0;
    @track totalVisits  = 0;
    @track lastSyncAt   = '-';

    @track pageSize     = 10;
    @track currentPage  = 1;
    @track totalRecords = 0;

    @track sortedBy;
    @track sortedDirection = 'asc';

    columns = [
        { label: 'Date',        fieldName: 'date'            },
        { label: 'Zone',        fieldName: 'zone_name'       },
        { label: 'Ambassador',  fieldName: 'ambassador_name', sortable: true },
        { label: 'Team',        fieldName: 'team_name'       },
        { label: 'Hours Spent', fieldName: 'hours_spent'     },
        { label: 'Visits',      fieldName: 'visits', type: 'number' },
        { label: 'Last Visit',  fieldName: 'last_visit'      }
    ];

    _data;

    @api
    get data() {
        return this._data;
    }

    set data(value) {
        this._data = value;

        console.log('ArtZoneCoverage → data received:', JSON.stringify(value));

        if (!value) {
            this.tableData = [];
            return;
        }

        // Parent passes res.data — so value IS the data payload directly
        // Expected shape:
        // {
        //     data    : [ ...rows... ],
        //     summary : { total_visits, total_records },
        //     period  : { last_sync_at }
        // }
        const obj = typeof value === 'string' ? JSON.parse(value) : value;

        const rows = obj?.data;
        console.log('ArtZoneCoverage → rows:', rows);

        if (!Array.isArray(rows)) {
            console.warn('ArtZoneCoverage → No valid rows found in data payload');
            this.tableData  = [];
            this.totalRecords = 0;
            return;
        }

        // Summary
        this.totalVisits = obj?.summary?.total_visits  || 0;
        this.totalZones  = obj?.summary?.total_records || 0;

        // Last Sync
        this.lastSyncAt = obj?.period?.last_sync_at
            ? new Date(obj.period.last_sync_at).toLocaleString()
            : '-';

        // Map rows
        this.allData = rows.map((r, index) => ({
            id             : index + 1,
            date           : r.date       ? new Date(r.date).toLocaleDateString()       : '-',
            zone_name      : r.zone_name       || '-',
            ambassador_name: r.ambassador_name || '-',
            team_name      : r.team_name       || '-',
            hours_spent    : r.hours_spent     || '0s',
            visits         : r.visits          || 0,
            last_visit     : r.last_visit ? new Date(r.last_visit).toLocaleDateString() : '-'
        }));

        this.totalRecords = this.allData.length;
        this.currentPage  = 1;

        this.updatePagination();

        console.log('ArtZoneCoverage → final tableData:', JSON.stringify(this.allData));
    }

    // =========================================================================
    // PAGINATION
    // =========================================================================
    updatePagination() {
        const start      = (this.currentPage - 1) * this.pageSize;
        const end        = start + this.pageSize;
        this.tableData   = this.allData.slice(start, end);
    }

    handleNext() {
        if (this.currentPage * this.pageSize < this.totalRecords) {
            this.currentPage++;
            this.updatePagination();
        }
    }

    handlePrevious() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.updatePagination();
        }
    }

    get isPreviousDisabled() {
        return this.currentPage === 1;
    }

    get isNextDisabled() {
        return this.currentPage * this.pageSize >= this.totalRecords;
    }

    get hasData() {
        return this.tableData.length > 0;
    }

    // =========================================================================
    // SORTING
    // =========================================================================
    handleSort(event) {
        const { fieldName, sortDirection } = event.detail;

        this.sortedBy        = fieldName;
        this.sortedDirection = sortDirection;

        const cloneData = [...this.allData];

        cloneData.sort((a, b) => {
            const val1 = a[fieldName] || '';
            const val2 = b[fieldName] || '';

            return sortDirection === 'asc'
                ? val1 > val2 ?  1 : -1
                : val1 < val2 ?  1 : -1;
        });

        this.allData = cloneData;
        this.updatePagination();
    }

    // =========================================================================
    // CSV EXPORT
    // =========================================================================
    handleExport() {
        if (!this.allData.length) {
            alert('No data to export');
            return;
        }

        const headers = ['Date', 'Zone', 'Ambassador', 'Team', 'Hours Spent', 'Visits', 'Last Visit'];

        const rows = this.allData.map(row =>
            [
                row.date,
                row.zone_name,
                row.ambassador_name,
                row.team_name,
                row.hours_spent,
                row.visits,
                row.last_visit
            ].map(val => `"${val ?? ''}"`)
             .join(',')
        );

        const csv      = [headers.join(','), ...rows].join('\n');
        const today    = new Date().toISOString().split('T')[0];
        const fileName = `Zone_Coverage_Report_${today}.csv`;

        const encodedUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);

        const link = document.createElement('a');
        link.href     = encodedUri;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}