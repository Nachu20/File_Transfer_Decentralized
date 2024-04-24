$(document).ready(() => {
    let reqConnectName = null;
    let isSender = null;

    let wsc = new WebSocket('wss://' + window.location.hostname.replace("/",""));

    let peerConnection;
    let servers = {
        icsServers: [
            {
                urls: ['stun:stun1.google.com:19302',
                    'stun:stun2.google.com:19302'
                ]
            }
        ]
    }
    let offer;
    let answer;
    let mediastream;
    let bigFile = 8000000000;
    let progress = {}
    let fileHandle;

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    var UserList = {};
    //set onclick to input file
    var key = 0;
    const getKey = () => {
        key += 1;
        return key;
    }
    const reqHostConnect = (event) => {
        let name = $(event.target).parent().children().eq(1).text();
        fileData = {}
        $(".file-checkbox[type=checkbox]:checked").each((index, element) => {

            let file = siteFileList[element.parentElement.getAttribute("key")]
            addFileToProgress(file[0], file[1], name, element.parentElement.getAttribute("key"));
        })
        if(Object.keys(fileData).length==0){
            alert("Please select files to send");
            return;
        }
        setAllInactive()
        $('#pairing').css('display', 'block')
        $("#dialog").show()
        $("#dialog-bg").css('display', 'flex')
        reqConnectName = name.toLowerCase().replace(" ","-");
        isSender = true;
        var message = { operation: "reqpair", name: reqConnectName, filedata: fileData }
        wsc.send(JSON.stringify(message))
    }

    const addActiveUser = (name, key) => {
        UserList[name] = key;
        let k = $(`<div class="active-user-div" key="${key}" >
        <div class="active-user-img"></div>
        <div class="active-user-name textHover" >${titleCase(name.replace("-"," "))}</div>
        <img class="active-user-send-icon" src="images/send-message.png" \>
    </div>`)
        k.children().eq(2).click(reqHostConnect)
        $("#active-users-container").append(k)
    }

    function titleCase(str) {
        var splitStr = str.toLowerCase().split(' ');
        for (var i = 0; i < splitStr.length; i++) {
            splitStr[i] = splitStr[i].charAt(0).toUpperCase() + splitStr[i].substring(1);     
        }
        return splitStr.join(' '); 
     }
    $("#clear-files").click((e)=>{
        $("#file-list-container").html("");
        siteFileList = {}
    })
    const removeActiveUser = (name) => {
        $("#active-users-container").children().each((index, element) => {
            if (element.getAttribute("key") == UserList[name]) {
                element.remove()
                delete UserList[name];
            }
        })
    }

    const setAllInactive = () => {
        var screenarray = ['pairing', 'reqpeer', 'declined','progress-dialog'];
        for (let i = 0; i < screenarray.length; i++) {
            if ($("#" + screenarray[i]).css("display") != "none")
                $("#" + screenarray[i]).css('display', 'none');
        }
    }

    const reqToPairDialog = (name, fldata) => {

        setAllInactive()
        $("#reqpeer").css('display', 'block')
        reqConnectName = name

        progress = fldata
        fileData = fldata
        let s = `<h2>${name} wants to send</h2>`
        for (let i in fldata) {
            s += `<h3>${fldata[i][0]} of size ${formatBytes(fldata[i][1],decimals=1)}</h3>`
        }
        $('#dialog').show()
        $("#dialog-bg").css('display', 'flex')
        $('#dialog-message').html(s);

    }


    $("#accept").click(async (e) => {
        isSender = false;
        $(".close-dialog").click()

        for (let i in progress) {
            if (progress[i][1] > bigFile) {
                let options = {
                    suggestedName: progress[i][0]
                }
                fileHandle = await window.showSaveFilePicker(options);
                progress[i].push(await fileHandle.createWritable());
            }
            else {
                progress[i].push([])
                progress[i].push(0)
            }
        }
        wsc.send(JSON.stringify({ operation: 'acceptreq', name: reqConnectName }))
        setAllInactive()
    })
    $("#decline").click((e) => {
        $("#dialog").hide()
        $("#dialog-bg").css('display', 'none')

        progress = {}
        wsc.send(JSON.stringify({ operation: 'rejectreq', name: reqConnectName }))
    })

    const addFile = (filename, filesize, file, key) => {
        siteFileList[key] = [filename, filesize, file]
        $("#file-list-container").append(`<div class="file-list-div" key="${key}">
                    <div class="file-name">${filename}</div>
                    <div class="file-size">${formatBytes(filesize,decimals=1)}</div>
                    <input type="checkbox" class="file-checkbox" checked="true">
                </div>`)
    }

    $("#input-file").change((e) => {
        var files = document.getElementById("input-file").files;
        for (var i = 0; i < files.length; i++) {
            addFile(files[i].name, files[i].size, files[i], getKey())
        }
    })
    $("#input-file-label").click((e) => {
        $("#input-file").click();
    })

    var fileData = {}
    const addFileToProgress = (filename, filesize, peername, key) => {
        fileData[key] = [filename, filesize, peername, 0];
    }
    const renderFileProgress = () => {
        $("#progress-container").html("");
        for (let key in fileData) {
            const value = fileData[key][3];
            const len = fileData[key][1];
            let percent = value * 100 / len;
            if(percent>100){
                percent=100;
            }
            let other;
            if (isSender) {
                other = "to";
            }
            else {
                other = "from"
            }
            $("#progress-container").append(`<div class="progress-bar" key="${key}">
            <div class="progress-header">
                <div class="progress-desc">${fileData[key][0]} ${other} ${reqConnectName}</div>
                <div class="progress-done">(${formatBytes(value,decimals=1)}/${formatBytes(fileData[key][1],decimals=1)})</div>
            </div>
            <div class="progress-denote">
                <div class="progress-bar-back">
                    <div class="progress-bar-thumb" style="width:${percent}%"></div>
                </div>
                <div class="progress-done-percent">${Math.ceil(percent)}%</div>
            </div>
        </div>`)

        }
    }
    const UpdateFileProgress = (key, value) => {
        fileData[key][3] = value;
        const len = fileData[key][1];
        let percent = value * 100 / len;
        if(percent>100){
            percent=100;
        }
        $(".progress-bar").each((index, e) => {
            if (e.getAttribute("key") == key) {
                $(e).find(".progress-done").html(`(${formatBytes(value,decimals=1)}/${formatBytes(fileData[key][1],decimals=1)})`);
                $(e).find(".progress-done-percent").html(`${Math.ceil(percent)}%`);
                $(e).find(".progress-bar-thumb").css("width", `${percent}%`);
            }
        })
    }
    const selectAll = () => {
        $(".file-checkbox").prop("checked", true)
    }
    const unSelectAll = () => {
        $(".file-checkbox").prop("checked", false)
    }
    $("#select-all").click(selectAll)
    $("#unselect-all").click(unSelectAll)



    var siteFileList = {}
    function formatBytes(bytes, decimals = 2) {
        if (!+bytes) return '0 Bytes'

        const k = 1024
        const dm = decimals < 0 ? 0 : decimals
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

        const i = Math.floor(Math.log(bytes) / Math.log(k))

        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
    }
    document.getElementById("drag-drop").ondrop = (ev) => {

        ev.preventDefault();

        if (ev.dataTransfer.items) {
            [...ev.dataTransfer.items].forEach((item, i) => {
                if (item.kind === "file") {
                    const file = item.getAsFile();
                    addFile(file.name, file.size, file, getKey());

                }
            });
        } else {
            [...ev.dataTransfer.files].forEach((file, i) => {
                addFile(file.name, file.size, file, getKey());
            });
        }
    }
    document.getElementById("drag-drop").ondragover = (ev) => {
        ev.preventDefault();
    }
    $("#send-dialog").click((e) => {
        setAllInactive();
        $("#progress-dialog").css('display','block');
        $("#dialog-bg").css('display', 'flex')
        renderFileProgress()
        $("#dialog").show()

    })
    $(".close-dialog").click((e) => {
        $("#dialog-bg").css('display', 'none')
        $("#dialog").hide()
    })
    

    const createConnection = async () => {

        let servers = {};

await (async() => {
  const response = await fetch("https://blobshare.metered.live/api/v1/turn/credentials?apiKey=331bb2d934d052eb8dc828ded3136ea0ee0e");
  const iceServers = await response.json();
  servers.iceServers = iceServers
})();

        peerConnection = new RTCPeerConnection(servers)
        peerConnection.onicecandidate = async (e) => {
            console.log(10);
            if (e.candidate) {
                if (isSender) {
                    offer = e.candidate
                }
                else {
                    answer = e.candidate
                }
                let message = { operation: "onicecandidate", sdp: e.candidate, name: reqConnectName }
                wsc.send(JSON.stringify(message))
            }
        }
    }
    const setChannelListeners = async () => {
        if (isSender) {
            mediastream = await peerConnection.createDataChannel('sendDataChannel')
            setConnectionType()
            mediastream.addEventListener('open', onSendChannelStateChange);
            mediastream.addEventListener('close', onSendChannelStateChange);
            mediastream.addEventListener('error', onMediaStreamError);
            console.log(100);
            setInterval(()=>{
                console.log(mediastream.readyState,peerConnection.connectionState);
            },1000)
        }
        else {
            peerConnection.addEventListener('datachannel', setRecieverStream);
        }
    }
    const setRecieverStream = (event) => {
        mediastream = event.channel
        setConnectionType()
        mediastream.onmessage = onReceiveMessageCallback;
        mediastream.onopen = onReceiveChannelStateChange;
        mediastream.onclose = onReceiveChannelStateChange;
        mediastream.onerror = onMediaStreamError;

    }
    const onSendChannelStateChange = () => {
        if (mediastream.readyState == 'open') {
            sendFile()
        }
        else if (mediastream.readyState == 'close') {
            console.log("media stream closed")
        }
    }
    var keyOrder = [];
    var currentFile;
    const onReceiveChannelStateChange = () => {

        if (mediastream.readyState == 'open') {
            console.log("reciever stream connected")
            keyOrder = [];
            for (let i in progress) {
                keyOrder.push(i);
            }
            keyOrder.sort();
            currentFile = 0;
        }
        else if (mediastream.readyState == 'close') {
            console.log("media stream closed")
        }
    }

    const addDataToFile = async (data, fileno) => {
        if (progress[keyOrder[fileno]].length == 5) {
            await progress[keyOrder[fileno]][4].write(data);
        }
        else {
            progress[keyOrder[fileno]][4].push(data);
        }
        progress[keyOrder[fileno]][3] += data.byteLength
        UpdateFileProgress(keyOrder[fileno],progress[keyOrder[fileno]][3])
    }

    const onReceiveMessageCallback = async (e) => {
        if (progress[keyOrder[currentFile]][1] <= (progress[keyOrder[currentFile]][3] + e.data.byteLength)) {
            progress[keyOrder[currentFile]][3] = progress[keyOrder[currentFile]][1];
        UpdateFileProgress(keyOrder[currentFile],progress[keyOrder[currentFile]][1])
            let bal = (progress[keyOrder[currentFile]][3] + e.data.byteLength) - progress[keyOrder[currentFile]][1];
            await addDataToFile(e.data.slice(0, bal), currentFile);
            if (currentFile + 1 != keyOrder.length)
                await addDataToFile(e.data.slice(bal), currentFile + 1);
            if (progress[keyOrder[currentFile]].length == 5) {
                await progress[keyOrder[currentFile]][4].close();
            }
            else {
                const recieved = new Blob(progress[keyOrder[currentFile]][4])
                progress[keyOrder[currentFile]][4] = []
                let link = document.createElement("a")
                link.download = progress[keyOrder[currentFile]][0];
                link.href = URL.createObjectURL(recieved)
                link.click()
            }
            currentFile++;
        }
        else {
            await addDataToFile(e.data, currentFile);
        }

    }

    const onMediaStreamError = (error) => {
        console.log("error in sending file")
        console.log(error)
    }

    const setConnectionType = async () => {
        mediastream.binaryType = 'arraybuffer';
    }
    const setLocalDescription = async (sdp) => {
        await peerConnection.setLocalDescription(sdp)
        console.log(1010);
    }
    const setRemoteDescription = async (sdp) => {
        
        await peerConnection.setRemoteDescription(sdp)
        console.log(101010);

    }
    const createOffer = async () => {
        offer = await peerConnection.createOffer();
        console.log(10101010);
    }
    const createAnswer = async () => {
        answer = await peerConnection.createAnswer()
        await setLocalDescription(answer) //setting sdp of remote to its answer
        console.log(10101010);
    }
    const destroyPeerConnection = async () => {
        peerConnection.close()
        offer = null
        answer = null
    }
    const sendFileContinuous = async (i) => {
        const chunksize = 16384;
        if (!siteFileList || !keyOrder || i >= keyOrder.length) {
            console.error("Invalid file list or key order.");
            return;
        }
        const fileF = siteFileList[keyOrder[i]][2];
        if (!fileF) {
            console.error("File object not found.");
            return;
        }
    
        let offset = 0;
        const fileReader = new FileReader();
        fileReader.onerror = (e) => {
            console.error("Error reading file:", e);
        };
        fileReader.onabort = (e) => {
            console.error("File reading aborted:", e);
        };
    
        const readSlice = async () => {
            const slice = fileF.slice(offset, offset + chunksize);
            await fileReader.readAsArrayBuffer(slice);
        };
    
        fileReader.onload = async (e) => {
            mediastream.send(e.target.result);
            offset += e.target.result.byteLength;
            UpdateFileProgress(keyOrder[i], offset);
    
            if (offset < fileF.size) {
                // Introduce a delay before reading the next slice
                setTimeout(async () => {
                    await readSlice();
                }, 1); // Adjust the delay time (in milliseconds) as needed
            } else {
                if (i + 1 < keyOrder.length) {
                    sendFileContinuous(i + 1);
                }
            }
        };
    
        await readSlice();
    };
    
    
    
    
    const sendFile = async () => {
        keyOrder = [];
        for (let i in fileData) {
            keyOrder.push(i);
        }
        keyOrder.sort();
        await sendFileContinuous(0);
    }



    wsc.onopen = async (e) => {
        isConnectionEstabllished = true;
        let publicIP = {};

        await fetch('https://ipv6.lafibre.info/ip.php').then(function (res) { return res.text(); }).then(function (res) { publicIP['ipv6'] = res }).catch((err)=>{publicIP['ipv6'] = 400});
        await fetch('https://ipv4.lafibre.info/ip.php').then(function (res) { return res.text(); }).then(function (res) { publicIP['ipv4'] = res }).catch((err)=>{publicIP['ipv4'] = 400});
        let data = { operation: 'createhost', network: publicIP }
        wsc.send(JSON.stringify(data))
    }
    wsc.onmessage = async (message) => {
        message = JSON.parse(message.data);
        if (message.operation == 'beginhosts') {

            $("#user-label").html("You are <span class='user-color'>" + titleCase(message.name.replace('-', ' '))+"</span>")
            for (let i = 0; i < message.namelist.length; i++) {
                addActiveUser(message.namelist[i], getKey());
            }
        }
        else if (message.operation == 'newhost') {
            addActiveUser(message.name, getKey())
        }
        else if (message.operation == 'hostleft') {
            removeActiveUser(message.name)
        }
        else if (message.operation == 'reqpair') {
            reqToPairDialog(message.name, message.filedata)
        }
        else if (message.operation == 'rejectreq') {
            setAllInactive()
            $("#declined").css('display', 'block')
            reqConnectName = null
        }
        else if (message.operation == 'acceptreq') {

            setAllInactive()
            $("#dialog").hide();
            $("#dialog-bg").css('display', 'none')

            isSender = true;
            reqConnectName = message.name;
            await createConnection()
            await setChannelListeners()
            await createOffer()
            await setLocalDescription(offer)
            let data = { operation: 'sendoffer', name: reqConnectName, offer: offer }
            wsc.send(JSON.stringify(data))
        }
        else if (message.operation == 'recvoffer') {
            $("#dialog").hide();
        $("#dialog-bg").css('display', 'none')
            await createConnection()
            await setRemoteDescription(message.offer)
            await setChannelListeners()
            await createAnswer()
            let data = { operation: 'sendanswer', name: reqConnectName, answer: answer }
            wsc.send(JSON.stringify(data))
        }
        else if (message.operation == 'recvanswer') {
            await setRemoteDescription(message.answer)
            console.log("connection established")

        }
        else if (message.operation == 'updateIce') {
            await sleep(1000);
            await peerConnection.addIceCandidate(message.ice)

        }
    }





})