import { LightningElement, api, track } from 'lwc';

export default class ArtMissedCheckpoints extends LightningElement {
    @track records = [];
    @api isloading = false;
    @api error;
    //lastSync='';
    @track lastSync = '';
    
 @track pageSize = 20;
@track currentPage = 1;
@track paginatedRecords = [];

    sortedBy;
    sortDirection = 'asc';

    // ✅ Datatable columns
    columns = [
        { label: 'Date', fieldName: 'date', type: 'text', sortable: true },
        { label: 'Ambassador', fieldName: 'ambassadorName', type: 'text', sortable: true },
        { label: 'Team', fieldName: 'teamName', type: 'text' },
        { label: 'Zone', fieldName: 'zoneName', type: 'text' },
        { label: 'Checkpoint Name', fieldName: 'checkpointName', type: 'text' },
        { label: 'Location (Lat/Lng)', fieldName: 'location', type: 'text' },
      {
    label: 'Status',
    fieldName: 'status',
    type: 'html',
    cellAttributes: {
        class: { fieldName: 'statusClass' },
    }
}
      // { label:'Missed %', fieldName: 'missedpercentage', type: 'text' },
      // { label:'Last Sync At', fieldName: 'lastsync', type: 'text' },

    ];

    // ✅ Data mapping
   @api
set missedData(value) {
    if (!value || !value.missed_checkpoints) {
        this.records = [];
        this.lastSync = '';
        return;
    }

    console.log('this.records'+ this.records );
    const missed = value.missed_checkpoints;

    this.lastSync = this.formatDateTime(
        value?.date_range?.last_sync_at
    );

    this.records = missed.map((r) => {
        const status = r.status || '';

        return {
            id: r.id,
            date: r.assignment_date
                ? new Date(r.assignment_date).toLocaleDateString()
                : '-',
            ambassadorName: r.ambassador_name || 'N/A',
            teamName: r.team_name || 'N/A',
            zoneName: r.zone_name || 'N/A',
            checkpointName: r.checkpoint_name || 'N/A',
            location: r.location?.coordinates
                ? `${r.location.coordinates[1]}, ${r.location.coordinates[0]}`
                : '-',

            status: status.toUpperCase(),

            statusHtml: status === 'missed'
                ? `<span class="pill missed">MISSED</span>`
                : `<span class="pill ok">OK</span>`
        };
    });

    this.currentPage = 1;
    this.updatePaginatedData();
}
    updatePaginatedData() {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = this.currentPage * this.pageSize;
    this.paginatedRecords = this.records.slice(start, end);
}
    get lastSyncLabel() {
    return this.records.length ? this.records[0].lastSync : '';
}
    // ✅ Helpers
    formatDateTime(dt) {
        if (!dt) return '—';
        try {
            return new Date(dt).toLocaleString();
        } catch {
            return dt;
        }
    }

    get missedData() {
        return this.records;
    }

    // ✅ Sorting
    handleSort(event) {
        const { fieldName, sortDirection } = event.detail;

        this.sortedBy = fieldName;
        this.sortDirection = sortDirection;

        let sortedData = [...this.records];

        sortedData.sort((a, b) => {
            let valA = a[fieldName] || '';
            let valB = b[fieldName] || '';

            return sortDirection === 'asc'
                ? valA > valB ? 1 : -1
                : valA < valB ? 1 : -1;
        });

        this.records = sortedData;
        this.updatePaginatedData();
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
        this.updatePaginatedData();
    }
}

handlePrevious() {
    if (this.currentPage > 1) {
        this.currentPage--;
        this.updatePaginatedData();
    }
}
get totalPages() {
    return Math.ceil(this.records.length / this.pageSize);
}

    // ✅ CSV export (unchanged)
    handleExport() {
        if (!this.records.length) {
            alert('No data to export');
            return;
        }

        let csv = 'Date,Ambassador,Team,Zone,Checkpoint Name,Location,Status\n';

        this.records.forEach(r => {
            const row = [
                r.date,
                r.ambassadorName,
                r.teamName,
                r.zoneName,
                r.checkpointName,
                r.location,
                r.status
            ].map(val => `"${val}"`).join(',');

            csv += row + '\n';
        });
          // ✅ Get today's date
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0]; // YYYY-MM-DD

    const fileName = `Ambassador_Missed_Checkpoints_${formattedDate}.csv`;

        const uri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
        const link = document.createElement('a');

        link.href = uri;
        link.download = fileName;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}