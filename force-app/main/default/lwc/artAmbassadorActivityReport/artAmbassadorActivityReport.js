import { LightningElement, api, track } from 'lwc';

export default class ArtAmbassadorActivityReport extends LightningElement {
@track records = [];
@track isloading = false;
@track error = null;
//@track lastSyncAt;
@track lastSync = '-';
@track dateRange = '-';

@track pageSize = 20;
@track currentPage = 1;
@track paginatedRecords = [];

// Datatable columns
columns = [
    { label: 'Date', fieldName: 'date', type: 'text', sortable: true },
    { label: 'Ambassador', fieldName: 'ambassadorName', type: 'text', sortable: true,wrapText: true, initialWidth: 180 },
    { label: 'Shift Start Time', fieldName: 'shiftStart', type: 'text', sortable: true,wrapText: true,initialWidth: 180 },
    { label: 'Shift End Time', fieldName: 'shiftEnd', type: 'text', sortable: true,wrapText: true,initialWidth: 180},
    { label: 'Team', fieldName: 'teamName', type: 'text', sortable: true,wrapText: true,initialWidth: 180},
    { label: 'Total Hours Worked', fieldName: 'totalHours', type: 'text', sortable: true,wrapText: true,initialWidth: 180 },
    { label: 'Total Distance Covered (miles)', fieldName: 'totalDistance', type: 'number', sortable: true,wrapText: true ,initialWidth: 180}
    // { label: 'Last Sync At', fieldName: 'lastSync', type: 'text', sortable: true }
];

_data;

@api
get data() {
    return this._data;
}

set data(value) {
this.isLoading = true;
this.error = null;

try {
    let obj = value;

    if (typeof value === 'string') {
        obj = JSON.parse(value);
    }

    // ✅ FIXED: no more obj.data
    const start = obj?.date_range?.start_date || '-';
    const end = obj?.date_range?.end_date || '-';
    this.dateRange = `${start} → ${end}`;

    this.lastSync = obj?.date_range?.last_sync_at
        ? new Date(obj.date_range.last_sync_at).toLocaleString()
        : '-';

    const activities = obj?.ambassador_activity || [];

    this.records = activities.map((a, idx) => ({
        id: idx + 1,
        date: a.date || '-',
        ambassadorName: a.ambassador_name || 'N/A',
        shiftStart: this.formatDate(a.shift_start_time),
        shiftEnd: this.formatDate(a.shift_end_time),
        teamName: a.team_name || 'N/A',
        totalHours: a.total_hours_worked || 0,
        totalDistance: a.total_distance_miles || 0
    }));

    this.currentPage = 1;
    this.updatePaginatedData();

} catch (e) {
    console.error('Error processing ambassador activity data:', e);
    this.records = [];
    this.error = 'Failed to process data';
} finally {
    this.isLoading = false;
}
}

formatDate(datetime) {
    if (!datetime) return '-';
    return new Date(datetime).toLocaleString();
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

handleExport() {
    if (!this.records.length) {
        alert('No data to export');
        return;
    }

    const headers = Object.keys(this.records[0]);
    let csv = headers.join(',') + '\n';

    this.records.forEach(r => {
        const row = headers.map(h => `"${r[h] || ''}"`);
        csv += row.join(',') + '\n';
    });
    const formattedDate = this.lastSync.split(',')[0].replace(/\//g, '-');
const fileName = `Ambassador_Activity_Report_${formattedDate}.csv`;

    const link = document.createElement('a');
    link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    link.download = fileName;
    link.click();
}
}