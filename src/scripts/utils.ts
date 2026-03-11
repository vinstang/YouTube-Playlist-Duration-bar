export const timeListToSeconds = (timeList: string[]): number => {
    let totalSeconds = 0;

    for (const ts of timeList) {
        const time = ts.split(':');
        let hours = 0;
        let minutes = 0;
        let seconds = 0;

        if (time.length === 3) {
            hours = parseInt(time[0], 10);
            minutes = parseInt(time[1], 10);
            seconds = parseInt(time[2], 10);
        } else if (time.length === 2) {
            minutes = parseInt(time[0], 10);
            seconds = parseInt(time[1], 10);
        }

        totalSeconds += seconds + (minutes * 60) + (hours * 60 * 60);
    }

    return totalSeconds;
};

export const secondsToTs = (seconds: number): string => {
    const totalHours = Math.floor(seconds / 3600);
    const totalMinutes = Math.floor((seconds - totalHours * 3600) / 60);
    const totalSecondsLeft = seconds - totalHours * 3600 - totalMinutes * 60;

    const zeroPad = (val: number): string => (val < 10) ? ('0' + val) : String(val);

    if (totalHours === 0) {
        return totalMinutes + ':' + zeroPad(totalSecondsLeft);
    }

    return totalHours + ':' + zeroPad(totalMinutes) + ':' + zeroPad(totalSecondsLeft);
};

export interface TotalTimeResult {
    watchedTs: string;
    remainingTs: string;
    totalTs: string;
    watchedPercent: number;
}

export const calculateTotalTime = (watchedList: string[], remainingList: string[]): TotalTimeResult => {
    const watchedSeconds = timeListToSeconds(watchedList);
    const remainingSeconds = timeListToSeconds(remainingList);
    const totalSeconds = watchedSeconds + remainingSeconds;
    const watchedPercent = totalSeconds > 0
        ? Math.round(watchedSeconds / totalSeconds * 100)
        : 0;

    return {
        watchedTs: secondsToTs(watchedSeconds),
        remainingTs: secondsToTs(remainingSeconds),
        totalTs: secondsToTs(totalSeconds),
        watchedPercent,
    };
};
