import { LightningElement ,api} from 'lwc';
export default class ArtTopPerformers extends LightningElement {
     @api data;
    @api isloading = false;

    // 🔍 Debug
    connectedCallback() {
        console.log('CHILD RECEIVED DATA:', JSON.stringify(this.data));
    }
   // 🎯 Compute lastSyncAt whenever data changes
     
get lastSyncAt() {
    // Return formatted date string or empty if missing
    return this.data?.report_period?.last_sync_at 
        ? new Date(this.data.report_period.last_sync_at).toLocaleString()
        : '';
}
    // ✅ Safe getters for KPI sections
    get workforce() {
        return this.data?.kpis?.workforce || {};
    }

    get coverage() {
        return this.data?.kpis?.coverage || {};
    }

    get checkpoints() {
        return this.data?.kpis?.checkpoints || {};
    }

    get topPerformers() {
        return this.data?.top_performers || [];
    }

get alerts() {
    return this.data?.alerts || [];
}
    // 🎯 KPI Cards (dynamic colors)
   get kpiCards() {
    const totalshift = this.workforce.total_ambassadors ?? 0;
    const active = this.workforce.active_ambassadors ?? 0;
    const total = this.workforce.total_ambassadors ?? 0;
    const hours = this.coverage.total_hours_worked ?? 0;
    const miles = this.coverage.total_miles_covered ?? 0;
    const coveragePct = this.checkpoints.overall_coverage_percentage ?? 0;
    const missed = this.checkpoints.missed_cehckpoint_percentage ?? 0;

    return [
        {
            label: 'Shift Attendance',
            value: `${active} / ${totalshift}`,
            icon: '👥',
            class: 'kpi-card kpi-yellow'
        },
        {
            label: 'Ambassadors On Duty',
            value: active,
            icon: '🟢',
            class: 'kpi-card kpi-yellow'
        },
        {
            label: 'Total Hours Worked',
            value: `${hours.toFixed(2)} hrs`,
            icon: '⏱️',
            class: 'kpi-card kpi-yellow'
        },
        {
            label: 'Distance Covered',
            value: `${miles.toFixed(2)} mi`,
            icon: '📍',
            class: 'kpi-card kpi-yellow'
        },
        {
            label: 'Checkpoint Completed %',
            value: `${coveragePct.toFixed(2)}%`,
            icon: '📊',
            class: 'kpi-card kpi-yellow'
        },
        {
            label: 'Checkpoint Missed %',
            value: missed + '%',
            icon: '⚠️',
            class: 'kpi-card kpi-yellow'
        }
    ];
}

getMissedClass(missed) {
    if (missed > 10) {
        return 'kpi-red';
    } else if (missed > 5) {
        return 'kpi-yellow';
    }
    return 'kpi-green';
}
    get hasData() {
        return !!(this.data && this.data.kpis);
    }

    handleExport() {
    try {
        if (!this.data) {
            alert('No data to export');
            return;
        }

        let csv = '';

        // ✅ SECTION 1: KPI CARDS
       /* csv += 'Dashboard Metrics\n';
        csv += 'Metric,Value\n';

        this.kpiCards.forEach(k => {
            csv += `"${k.label}","${k.value}"\n`;
        });

        csv += '\n'; // spacing*/

        // ✅ SECTION 2: TOP PERFORMERS
        csv += 'Top Performers\n';
        csv += 'Rank,Ambassador,Coverage %,Hours Worked,Miles Covered,Checkpoints Completed\n';

        (this.topPerformers || []).forEach(tp => {
            csv += `"${tp.rank}","${tp.ambassador_name}","${tp.coverage_percentage}","${tp.hours_worked}","${tp.miles_covered}","${tp.checkpoints_completed}"\n`;
        });

const formattedDate = this.lastSyncAt.split(',')[0].replace(/\//g, '-');
    const fileName = `Top_Perfomance_${formattedDate}.csv`;
        // ✅ LWS SAFE DOWNLOAD
        const uri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);

        const link = document.createElement('a');
        link.href = uri;
        link.download = fileName;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    } catch (e) {
        console.error('Export failed:', e);
        alert('❌ Export failed');
    }
}
}