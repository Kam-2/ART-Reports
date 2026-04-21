import { LightningElement, api, track } from 'lwc';

export default class ArtBoundaryBreachReport extends LightningElement {
@track records = [];
@track isloading = false;
@track error = null;

@track pageSize = 20;
@track currentPage = 1;
@track paginatedRecords = [];

_data;

@track lastSync = '';

// ✅ Datatable columns
columns = [
    //{ label: '#', fieldName: 'id', type: 'number', sortable: true },
    { label: 'Ambassador', fieldName: 'ambassadorName', type: 'text', sortable: true },
    { label: 'Team', fieldName: 'teamName', type: 'text', sortable: true },
    { label: 'Zone', fieldName: 'zoneName', type: 'text', sortable: true },
    { label: 'Breach Start Time', fieldName: 'breachStart', type: 'text', sortable: true },
    { label: 'Breach End Time', fieldName: 'breachEnd', type: 'text', sortable: true },
    { label: 'Breach Duration', fieldName: 'duration', type: 'text', sortable: true },
    { label: 'Breach Location (Lat/Lng)', fieldName: 'location', type: 'text' },
    { label: 'Breach Distance (miles)', fieldName: 'distance', type: 'number', sortable: true }
    //{ label: 'Last Sync At', fieldName: 'lastsync', type: 'number', sortable: true }
];

@api
get data() {
    return this._data;
}

set data(value) {
    this.isloading = true;
    this.error = null;
this.lastSync = '';
    try {
        let obj = value;
        if (typeof value === 'string') {
            obj = JSON.parse(value);
        }

        const breaches = obj?.data?.breaches;
        if (!breaches || !Array.isArray(breaches)) {
this.records = [];
this.paginatedRecords = [];
return;
}
            this.lastSync = this.formatDate(
    value?.data?.date_range?.last_sync_at
);

        this.records = breaches.map((b, idx) => ({
            id: idx + 1,
                //date: this.formatOnlyDate(b.breach_start_time),

            ambassadorName: b.ambassador_name || 'N/A',
            teamName: b.team_name || 'N/A',
            zoneName: b.zone_name || 'N/A',
            breachStart: this.formatDate(b.breach_start_time),
            breachEnd: this.formatDate(b.breach_end_time),
            duration: b.breach_duration,
            location: b.breach_location ? `${b.breach_location.lat}, ${b.breach_location.lng}` : 'N/A',
            distance: b.breach_distance_miles
        //lastsync: lastSync ? this.formatDate(lastSync) : 'N/A'
        }));
        this.currentPage = 1;
this.updatePaginatedData();
        console.log('this.records'+this.records);
    } catch (e) {
        console.error('Error processing boundary breach data:', e);
        this.records = [];
        this.error = 'Failed to process boundary breach data';
    } finally {
        this.isloading = false;
    }
}

updatePaginatedData() {
const start = (this.currentPage - 1) * this.pageSize;
const end = this.currentPage * this.pageSize;
this.paginatedRecords = this.records.slice(start, end);
}

get totalPages() {
return Math.ceil(this.records.length / this.pageSize);
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
    get lastSyncLabel() {
return this.records.length ? this.records[0].lastSync : '';
}


formatDate(datetime) {
    if (!datetime) return '-';
    return new Date(datetime).toLocaleString();
}

// ✅ Sorting
handleSort(event) {
    const { fieldName, sortDirection } = event.detail;
    let sortedData = [...this.records];

    sortedData.sort((a, b) => {
        let val1 = a[fieldName] || '';
        let val2 = b[fieldName] || '';
        return sortDirection === 'asc' ? (val1 > val2 ? 1 : -1) : (val1 < val2 ? 1 : -1);
    });

    this.records = sortedData;
    this.updatePaginatedData();
}

// ✅ Export CSV
handleExport() {
    if (!this.records.length) {
        alert('No data to export');
        return;
    }

    const headers = this.columns.map(c => c.label);
    let csv = headers.join(',') + '\n';

    this.records.forEach(r => {
        const row = this.columns.map(c => `"${r[c.fieldName] || ''}"`);
        csv += row.join(',') + '\n';
    });

const formattedDate = this.lastSync
? this.lastSync.split(',')[0].replace(/\//g, '-')
: 'report';   
    const fileName = `Boundary_Breach_Report_${formattedDate}.csv`;
    const link = document.createElement('a');
    link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    link.download = fileName;
    link.click();
}
}