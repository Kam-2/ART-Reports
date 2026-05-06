import { LightningElement, api, track } from 'lwc';

export default class ArtCoverageReports extends LightningElement {

@track records = [];
@track isloading = false;

@track overallCoverage = 0;
@track overallMissed = 0;
@track totalRecords = 0;
@track totalCheckpoints =0;
lastSync;

@track pageSize = 20;
@track currentPage = 1;
@track paginatedRecords = [];
sortedBy;
sortDirection = 'asc';

_data;

columns = [
    { label: 'Date', fieldName: 'date' },
    { label: 'Ambassador', fieldName: 'ambassador',sortable: true },
    { label: 'Team', fieldName: 'team' },
    { label: 'Zone', fieldName: 'zone' },
    { label: 'Checkpoint Name', fieldName: 'checkpoints' },
    //{ label: 'Assigned Zone', fieldName: 'assigned' },
    //{ label: 'Completed', fieldName: 'completed' },
    //{ label: 'Missed', fieldName: 'missed' },
    { label: 'Coverage %', fieldName: 'coverage' },
    { label: 'Missed %', fieldName: 'missedPct' }
];

@api
get data() {
    return this._data;
}

set data(value) {
this._data = value;
this.isloading = true;

try {
    const obj = value;

    const checkpoints = obj?.checkpoints || [];
    const summary = obj?.summary || {};
    
    this.totalCheckpoints=summary.total_checkpoints || 0;
    this.totalRecords = summary.total_records || 0;
    this.overallCoverage = summary.overall_coverage_percentage?.toFixed(2) || 0;
    this.overallMissed = summary.overall_missed_percentage?.toFixed(2) || 0;

    const dateRange = obj?.date_range || {};
    this.lastSync = dateRange.last_sync_at
        ? new Date(dateRange.last_sync_at).toLocaleString()
        : '-';

    if (!checkpoints.length) {
        this.records = [];
        this.paginatedRecords = [];
        return;
    }

    const grouped = {};

    checkpoints.forEach(cp => {
        const key = `${cp.date}|${cp.ambassador_name}|${cp.team_name}|${cp.assigned_zone}`;

        if (!grouped[key]) {
            grouped[key] = {
                date: cp.date,
                ambassador: cp.ambassador_name,
                team: cp.team_name,
                zone: cp.assigned_zone,
                assigned: 0,
                completed: 0,
                missed: 0,
                checkpointNames: []
            };
        }

        grouped[key].assigned += 1;

        if (cp.status === 'completed') grouped[key].completed += 1;
        else grouped[key].missed += 1;

        grouped[key].checkpointNames.push(cp.checkpoint_name || '-');
    });

    this.records = Object.values(grouped).map(row => {
        const coverage = row.assigned
            ? ((row.completed / row.assigned) * 100).toFixed(2)
            : 0;

        const missed = row.assigned
            ? ((row.missed / row.assigned) * 100).toFixed(2)
            : 0;

        return {
            id: `${row.date}-${row.ambassador}-${row.zone}`,
            date: new Date(row.date).toLocaleDateString(),
            ambassador: row.ambassador || 'N/A',
            team: row.team || 'N/A',
            zone: row.zone || 'N/A',
            checkpoints: row.checkpointNames.join(', '),
            assigned: row.assigned,
            completed: row.completed,
            missed: row.missed,
            coverage: coverage + '%',
            missedPct: missed + '%'
        };
    });

    this.currentPage = 1;
    this.updatePaginatedData();

} catch (e) {
    console.error('❌ Error parsing coverage data:', e);
    this.records = [];
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

handleExport() {
    try {
        if (!this.records || !this.records.length) {
            alert('No data to export');
            return;
        }

        let csv = '';
        csv += 'Date,Ambassador,Team,Zone,Checkpoints,Assigned,Completed,Missed,Coverage %,Missed %\n';

        this.records.forEach(r => {
            const row = [
                r.date,
                r.ambassador,
                r.team,
                r.zone,
                r.checkpoints,
                r.assigned,
                r.completed,
                r.missed,
                r.coverage,
                r.missedPct
            ]
            .map(val => `"${val ?? ''}"`)
            .join(',');

            csv += row + '\n';
        });
        // const today = this.lastSync;
const formattedDate = this.lastSync && this.lastSync !== '-'
? this.lastSync.split(',')[0].replace(/\//g, '-')
: 'report';
const fileName = `Ambassador_Checkpoint_Perfomance_${formattedDate}.csv`;

        const uri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
        const link = document.createElement('a');
        link.href = uri;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (e) {
        console.error('❌ Export failed:', e);
        alert('Export failed');
    }
}
}