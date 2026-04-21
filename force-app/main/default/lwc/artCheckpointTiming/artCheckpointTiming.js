import { LightningElement, api, track } from 'lwc';

export default class ArtCheckpointTiming extends LightningElement {
@track records = [];
@track isloading = false;
@track error = null;
@track lastSync;

@track pageSize = 20;
@track currentPage = 1;
@track paginatedRecords = [];

_data;

// ✅ Datatable columns
columns = [
    //{ label: '#', fieldName: 'id', type: 'number', sortable: true },
    { label: 'Date', fieldName: 'date', type: 'text', sortable: true },
    { label: 'Zone', fieldName: 'zoneName', type: 'text', sortable: true },
    { label: 'Ambassador', fieldName: 'ambassadorName', type: 'text', sortable: true },
    { label: 'Team', fieldName: 'ambassadorTeam', type: 'text', sortable: true },
    { label: 'Checkpoint Name', fieldName: 'checkpointName', type: 'text' },
    { label: 'Start Checkpoint', fieldName: 'from', type: 'text' },
    { label: 'End Checkpoint', fieldName: 'to', type: 'text' },
    { label: 'Transit Distance', fieldName: 'distance', type: 'number', sortable: true },
    { label: 'Transit Time', fieldName: 'time', type: 'text' },
    { label: 'Avg Speed', fieldName: 'speed', type: 'text', sortable: true }
    //{ label: 'Last Sync At', fieldName: 'lastsync', type: 'text', sortable: true }
];


get data() {
    return this._data;
}


@api
set data(value) {
this.isloading = true;
this.error = null;

try {
    console.log('⏱ RAW INPUT:', value);

    let obj = value;

    // 🔥 Handle string response
    if (typeof value === 'string') {
        obj = JSON.parse(value);
    }

    console.log('⏱ PARSED OBJECT:', obj);

    // 🔥 Normalize API structure (handles both nested & flat responses)
    const root = obj?.data || obj;

    const summary = root?.summary || {};
    const pairs = root?.checkpoint_pairs || [];

    // 🔥 Safe last sync
    this.lastSync = summary?.last_sync_at
        ? new Date(summary.last_sync_at).toLocaleString()
        : '-';

    // 🔥 Validate array safely
    if (!Array.isArray(pairs)) {
        console.warn('⚠️ checkpoint_pairs invalid:', pairs);
        this.records = [];
        this.paginatedRecords = [];
        return;
    }

    // 🔥 Map records safely
    this.records = pairs.map((p, idx) => {
        const first = p.first_checkpoint || {};
        const second = p.second_checkpoint || {};

        const distanceMeters = p.distance_between_checkpoints_meters;
        const timeSec = p.time_between_checkpoints_seconds;

        const speed =
            p.speed_mps
                ? (p.speed_mps * 3.6).toFixed(2) + ' km/h'
                : (distanceMeters && timeSec
                    ? ((distanceMeters / timeSec) * 3.6).toFixed(2) + ' km/h'
                    : 'N/A');

        return {
            id: p.sequence_number || idx + 1,
            date: this.formatDate(first.visited_at),
            zoneName: first.zone_name || 'N/A',
            ambassadorName: first.ambassador_name || 'N/A',
            ambassadorTeam: first.team_name || 'N/A',
            checkpointName: first.checkpoint_name || '-',
            from: first.checkpoint_name || '-',
            to: second.checkpoint_name || '-',
            distance: p.distance_between_checkpoints_miles ?? 0,
            time: p.time_between_checkpoints_formatted || '-',
            speed: speed,
            lastsync: p.last_sync_at || '-'
        };
    });

    console.log('✅ Records Loaded:', this.records.length);

    // 🔥 Pagination reset
    this.currentPage = 1;
    this.updatePaginatedData();

} catch (e) {
    console.error('❌ Setter Error:', e);
    this.records = [];
    this.paginatedRecords = [];
    this.error = 'Failed to process checkpoint data';
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
formatDate(datetime) {
    if (!datetime) return '-';
    return new Date(datetime).toLocaleString();
}

formatKm(meters) {
    if (meters == null) return 'N/A';
    return (meters / 1000).toFixed(2) + ' km';
}

// ✅ Sorting
handleSort(event) {
    const { fieldName, sortDirection } = event.detail;

    let sortedData = [...this.records];

    sortedData.sort((a, b) => {
        let val1 = a[fieldName] || '';
        let val2 = b[fieldName] || '';

        return sortDirection === 'asc'
            ? val1 > val2 ? 1 : -1
            : val1 < val2 ? 1 : -1;
    });

    this.records = sortedData;
    this.updatePaginatedData();
}

// ✅ Export
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
const fileName = `Checkpoint_Transit_Time_${formattedDate}.csv`;
    const link = document.createElement('a');
    link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    link.download = fileName;
    link.click();
}
}