import { LightningElement, api, track } from 'lwc';

export default class ArtAmbassadorIdleReport extends LightningElement {

    @api isloading;
    @api error;

    @track pageSize    = 20;
    @track currentPage = 1;

    _data;

    columns = [
        { label: 'Date',             fieldName: 'date'          },
        { label: 'Ambassador',       fieldName: 'ambassadorName'},
        { label: 'Team',             fieldName: 'teamName'      },
        { label: 'Idle Start Time',  fieldName: 'startTime'     },
        { label: 'Idle End Time',    fieldName: 'endTime'       },
        { label: 'Idle Duration',    fieldName: 'duration'      },
        { label: 'Location (Lat/Lng)',fieldName: 'location'     }
    ];

    // =========================================================================
    // API SETTER — parent passes res.data directly
    // Expected shape:
    // {
    //     idle_activity : [ ...rows... ],
    //     date_range    : { last_sync_at }
    // }
    // =========================================================================
    @api
    get data() {
        return this._data;
    }

    set data(value) {
        this._data     = value;
        this.currentPage = 1;
        console.log('ArtAmbassadorIdleReport → data received:', JSON.stringify(value));
    }

    // =========================================================================
    // LAST SYNC
    // =========================================================================
    get lastSync() {
        // one .data level removed vs old code
        return this.formatDateTime(this._data?.date_range?.last_sync_at);
    }

    // =========================================================================
    // MAIN DATA MAPPING
    // =========================================================================
    get fullData() {
        if (!this._data) return [];

        // one .data level removed — _data IS the payload
        const idleList = this._data?.idle_activity || [];

        console.log('ArtAmbassadorIdleReport → idleList:', idleList);

        if (!Array.isArray(idleList)) {
            console.warn('ArtAmbassadorIdleReport → idle_activity is not an array');
            return [];
        }

        return idleList.map((item, index) => ({
            id            : index,
            date          : item?.date             || '-',
            ambassadorName: item?.ambassador_name  || '-',
            teamName      : item?.team_name        || 'N/A',
            startTime     : this.formatDateTime(item?.idle_start_time),
            endTime       : this.formatDateTime(item?.idle_end_time),
            duration      : item?.idle_duration    || 0,
            location      : item?.stop_location?.lat && item?.stop_location?.lng
                ? `${item.stop_location.lat}, ${item.stop_location.lng}`
                : '-'
        }));
    }

    // =========================================================================
    // PAGINATION
    // =========================================================================
    get tableData() {
        const start = (this.currentPage - 1) * this.pageSize;
        const end   = this.currentPage * this.pageSize;
        return this.fullData.slice(start, end);
    }

    get totalPages() {
        return Math.ceil(this.fullData.length / this.pageSize) || 1;
    }

    get isPreviousDisabled() {
        return this.currentPage === 1;
    }

    get isNextDisabled() {
        return this.currentPage >= this.totalPages;
    }

    handleNext() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
        }
    }

    handlePrevious() {
        if (this.currentPage > 1) {
            this.currentPage--;
        }
    }

    get hasData() {
        return this.tableData.length > 0;
    }

    // =========================================================================
    // CSV EXPORT — exports fullData (all pages)
    // =========================================================================
    handleExport() {
        if (!this.fullData.length) {
            alert('No data to export');
            return;
        }

        const headers = ['Date', 'Ambassador', 'Team', 'Start Time', 'End Time', 'Duration', 'Location'];

        const rows = this.fullData.map(row =>
            [
                row.date,
                row.ambassadorName,
                row.teamName,
                row.startTime,
                row.endTime,
                row.duration,
                row.location
            ].map(val => `"${val ?? ''}"`)
             .join(',')
        );

        const csv = [headers.join(','), ...rows].join('\n');

        const formattedDate = this.lastSync
            ? this.lastSync.split(',')[0].replace(/\//g, '-')
            : new Date().toISOString().split('T')[0];

        const fileName = `Ambassador_Idle_Report_${formattedDate}.csv`;

        const link    = document.createElement('a');
        link.href     = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // =========================================================================
    // UTILS
    // =========================================================================
    formatDateTime(dt) {
        if (!dt) return '-';
        try {
            return new Date(dt).toLocaleString();
        } catch {
            return dt;
        }
    }
}