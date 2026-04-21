import { LightningElement, api, track } from 'lwc';

export default class ArtAmbassadorShiftinShiftout extends LightningElement {

    _data;

    @api isloading;
    @api error;

    @track lastSync    = '';
    @track pageSize    = 20;
    @track currentPage = 1;

    columns = [
        { label: 'Date',               fieldName: 'date'          },
        { label: 'Ambassador',         fieldName: 'ambassadorName'},
        { label: 'Shift Start Time',   fieldName: 'shiftStart'    },
        { label: 'Shift End Time',     fieldName: 'shiftEnd'      },
        { label: 'Team',               fieldName: 'teamName'      },
        { label: 'Total Hours Worked', fieldName: 'totalHours', type: 'text' },
        { label: 'First GPS Location', fieldName: 'firstLocation' },
        { label: 'Last GPS Location',  fieldName: 'lastLocation'  }
    ];

    // =========================================================================
    // API SETTER — parent passes res.data directly
    // Expected shape:
    // {
    //     shift_status : [ ...rows... ],
    //     date_range   : { last_sync_at }
    // }
    // =========================================================================
    @api
    get data() {
        return this._data;
    }

    set data(value) {
        this._data     = value;
        this.currentPage = 1;

        console.log('ArtAmbassadorShiftinShiftout → data received:', JSON.stringify(value));

        // Parent passes res.data — obj IS the payload, no extra .data wrapper
        this.lastSync = this.formatDateTime(value?.date_range?.last_sync_at);
    }

    // =========================================================================
    // COMPUTED — transform on read (no @track allData needed)
    // =========================================================================
    get fullData() {
        if (!this._data) return [];

        // one .data level removed vs old code
        const list = this._data?.shift_status;

        if (!Array.isArray(list)) {
            console.warn('ArtAmbassadorShiftinShiftout → shift_status not an array');
            return [];
        }

        return list.map((item, index) => ({
            id            : item.shift_id || index,
            date          : item.date           || '—',
            ambassadorName: item.ambassador_name || '—',
            shiftStart    : this.formatDateTime(item.shift_start_time),
            shiftEnd      : this.formatDateTime(item.shift_end_time),
            teamName      : item.team_name       || 'N/A',
            totalHours    : item.total_hours_worked ?? 0,
            firstLocation : this.formatGPS(item.first_gps_location),
            lastLocation  : this.formatGPS(item.last_gps_location)
        }));
    }

    get tableData() {
        const start = (this.currentPage - 1) * this.pageSize;
        const end   = this.currentPage * this.pageSize;
        return this.fullData.slice(start, end);
    }

    get hasData() {
        return this.tableData.length > 0;
    }

    // =========================================================================
    // PAGINATION
    // =========================================================================
    get totalPages() {
        return Math.ceil(this.fullData.length / this.pageSize);
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

    // =========================================================================
    // CSV EXPORT
    // =========================================================================
    handleExport() {
        if (!this.fullData.length) {
            alert('No data to export');
            return;
        }

        const headers = [
            'Date', 'Ambassador Name', 'Shift Start', 'Shift End',
            'Team', 'Total Hours', 'First Location', 'Last Location'
        ];

        const rows = this.fullData.map(row =>
            [
                row.date,
                row.ambassadorName,
                row.shiftStart,
                row.shiftEnd,
                row.teamName,
                row.totalHours,
                row.firstLocation,
                row.lastLocation
            ].map(val => `"${val ?? ''}"`)
             .join(',')
        );

        const csv = [headers.join(','), ...rows].join('\n');

        const formattedDate = this.lastSync
            ? this.lastSync.split(',')[0].replace(/\//g, '-')
            : new Date().toISOString().split('T')[0];

        const fileName = `Ambassador_ShiftIn_ShiftOut_Report_${formattedDate}.csv`;

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
        if (!dt) return '—';
        try {
            return new Date(dt).toLocaleString();
        } catch {
            return dt;
        }
    }

    formatGPS(loc) {
        if (!loc || loc.lat == null || loc.lng == null) return '—';
        return `${loc.lat}, ${loc.lng}`;
    }
}