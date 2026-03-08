export const timeListToSeconds = (timeList) => {
    let totalSeconds = 0;
    let hours = 0;
    let minutes = 0;
    let seconds = 0;

    for (const ts of timeList) {
        let time = ts.split(":");

        if (time.length == 3) {
            hours = parseInt(time[0]);
            minutes = parseInt(time[1]);
            seconds = parseInt(time[2]);
        } else if (time.length == 2) {
            hours = 0;
            minutes = parseInt(time[0]);
            seconds = parseInt(time[1]);
        }

        totalSeconds += seconds + (minutes * 60) + (hours * 60 * 60);
    }

    return totalSeconds;
}

export const secondsToTs = (seconds) => {
    let totalHours = Math.floor(seconds / 3600);
    let totalMinutes = Math.floor((seconds - totalHours * 3600) / 60);
    let totalSecondsLeft = seconds - totalHours * 3600 - totalMinutes * 60;

    let zeroPad = (val) => (val < 10) ? ("0" + val) : (val);

    if (totalHours == 0)
        return totalMinutes + ":" + zeroPad(totalSecondsLeft);
    else
        return totalHours + ":" + zeroPad(totalMinutes) + ":" + zeroPad(totalSecondsLeft);
}

export const calculateTotalTime = (watchedList, remainingList) => {
    let watchedSeconds = timeListToSeconds(watchedList);
    let remainingSeconds = timeListToSeconds(remainingList);
    let totalSeconds = watchedSeconds + remainingSeconds;
    let watchedPercent = 0;
    if (totalSeconds > 0)
        watchedPercent = Math.round(watchedSeconds / totalSeconds * 100);

    let watchedTs = secondsToTs(watchedSeconds);
    let remainingTs = secondsToTs(remainingSeconds);
    let totalTs = secondsToTs(totalSeconds);

    return { watchedTs, remainingTs, totalTs, watchedPercent };
}
