// Playlist page no need dark light mode switching
let theme;

let divDurationBlock;
let durationTotal;
let videoCounted;

export const updateDurationPlaylist = () => {
    if (theme === undefined)
        theme = checkTheme();

    let { count, fullList } = getVideoTimeList();
    let totalSeconds = timeListToSeconds(fullList);

    let totalTs = secondsToTs(totalSeconds);

    if (document.getElementById('duration-block-playlist') === null) {
        createUiELement();
        appendUiElement();
    }

    updateUI(totalTs, count);
}

const createUiELement = () => {
    // <div Outer duration block
    divDurationBlock = document.createElement("div");
    divDurationBlock.setAttribute(theme, "");
    divDurationBlock.id = "duration-block-playlist";
    divDurationBlock.className = "duration-block";

    // <Span> Total:
    durationTotal = document.createElement('span');
    durationTotal.setAttribute(theme, "");
    durationTotal.id = 'duration-total-playlist';
    durationTotal.className = 'duration-content';
    durationTotal.title = "Only count video shown in the playlist panel.";

    // <Span> Video counted
    videoCounted = document.createElement('span');
    videoCounted.setAttribute(theme, "");
    videoCounted.id = 'video-counted';
    videoCounted.className = 'duration-content';
    videoCounted.title = "If this number not matching the total number of videos in this playlist,\nscroll down to load more video, or some videos are hidden.";
}

const appendUiElement = () => {
    const headerContents = document.querySelector('#page-manager [page-subtype="playlist"] > ytd-playlist-header-renderer > div > div.immersive-header-content.style-scope.ytd-playlist-header-renderer > div.thumbnail-and-metadata-wrapper.style-scope.ytd-playlist-header-renderer > div > div.metadata-action-bar.style-scope.ytd-playlist-header-renderer')
    headerContents.insertAdjacentElement('afterend', divDurationBlock);

    divDurationBlock.appendChild(durationTotal);
    divDurationBlock.appendChild(videoCounted);
}

const checkTheme = () => {
    if ( window &&
         window.matchMedia &&
         window.matchMedia('(prefers-color-scheme: dark)').matches ) {
        return ("dark");
    }
    return ("light");
}

const getVideoTimeList = () => {
    let videos_list = document.querySelector('#page-manager [page-subtype="playlist"] #contents #contents #contents');
    let videos = [];

    if (videos_list != null) {
        videos = videos_list.children;
    }

    let count = 0;
    let fullList = [];
    
    for (const video of videos) {
        let ts = "";
        let videoTimeElement = video.querySelector("#text");

        if (videoTimeElement == null || videoTimeElement.innerText == '') {
            ts = "00:00";
        }
        else {
            ts = videoTimeElement.innerText.trim();
        }
        fullList.push(ts);
        count++;
    }
    return { count, fullList };
}

const timeListToSeconds = (timeList) => {
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

const secondsToTs = (seconds) => {
    let totalHours = Math.floor(seconds / 3600);
    let totalMinutes = Math.floor((seconds - totalHours * 3600) / 60);
    let totalSecondsLeft = seconds - totalHours * 3600 - totalMinutes * 60;

    let zeroPad = (val) => (val < 10) ? ("0" + val) : (val);

    if (totalHours == 0)
        return totalMinutes + ":" + zeroPad(totalSecondsLeft);
    else
        return totalHours + ":" + zeroPad(totalMinutes) + ":" + zeroPad(totalSecondsLeft);
}

const updateUI = (totalTs, count) => {
    durationTotal.innerText = "Total duration: " + totalTs;
    videoCounted.innerText = "Videos counted: " + count;
}
