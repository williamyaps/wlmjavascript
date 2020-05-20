'use strict';

/* globals MediaRecorder */
// Spec is at http://dvcs.w3.org/hg/dap/raw-file/tip/media-stream-capture/RecordingProposal.html

var constraints = {audio:true,video:{width:{min:320,ideal:320,max:640 },height:{ min:240,ideal:240,max:480},framerate:30}};

var recBtn = document.querySelector('button#rec');
var pauseResBtn = document.querySelector('button#pauseRes');
var stopBtn = document.querySelector('button#stop');

var videoElement = document.querySelector('video');
var dataElement = document.querySelector('#data');
var downloadLink = document.querySelector('a#downloadLink');

videoElement.controls = false;

var mediaRecorder;
var chunks = [];
var count = 0;
var localStream = null;
var soundMeter  = null;

if (!navigator.mediaDevices.getUserMedia){
	alert('navigator.mediaDevices.getUserMedia not supported on your browser, use the latest version of Firefox or Chrome');
}else{
	if (window.MediaRecorder == undefined) {
			alert('MediaRecorder not supported on your browser, use the latest version of Firefox or Chrome');
	}else{
		navigator.mediaDevices.getUserMedia(constraints)
			.then(function(stream) {
				localStream = stream;
				
				localStream.getTracks().forEach(function(track) {
					if(track.kind == "audio"){
						track.onended = function(event){
							 log("audio track.onended Audio track.readyState="+track.readyState+", track.muted=" + track.muted);
						}
					}
					if(track.kind == "video"){
						track.onended = function(event){
							log("video track.onended Audio track.readyState="+track.readyState+", track.muted=" + track.muted);
						}
					}
				});
				
				videoElement.srcObject = localStream;
				videoElement.play();
				
				try {
					window.AudioContext = window.AudioContext || window.webkitAudioContext;
					window.audioContext = new AudioContext();
				  } catch (e) {
					log('Web Audio API not supported.');
				  }

				  soundMeter = window.soundMeter = new SoundMeter(window.audioContext);
				  soundMeter.connectToSource(localStream, function(e) {
					if (e) {
						log(e);
						return;
					}else{
					   /*setInterval(function() {
						  log(Math.round(soundMeter.instant.toFixed(2) * 100));
					  }, 100);*/
					}
				  });
				
			}).catch(function(err) {
				/* handle the error */
				log('navigator.getUserMedia error: '+err);
			});
	}
}

function onBtnRecordClicked (){
	if (localStream == null) {
		alert('Could not get local stream from mic/camera');
	}else {
		recBtn.disabled = true;
		pauseResBtn.disabled = false;
		stopBtn.disabled = false;

		/* use the stream */
		log('Start recording...');
		if (typeof MediaRecorder.isTypeSupported == 'function'){
			/*
				MediaRecorder.isTypeSupported is a function announced in https://developers.google.com/web/updates/2016/01/mediarecorder and later introduced in the MediaRecorder API spec http://www.w3.org/TR/mediastream-recording/
			*/
			if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
			  var options = {mimeType: 'video/webm;codecs=vp9'};
			} else if (MediaRecorder.isTypeSupported('video/webm;codecs=h264')) {
			  var options = {mimeType: 'video/webm;codecs=h264'};
			} else  if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
			  var options = {mimeType: 'video/webm;codecs=vp8'};
			}
			log('Using '+options.mimeType);
			mediaRecorder = new MediaRecorder(localStream, options);
		}else{
			log('isTypeSupported is not supported, using default codecs for browser');
			mediaRecorder = new MediaRecorder(localStream);
		}

		mediaRecorder.ondataavailable = function(e) {
			//log('mediaRecorder.ondataavailable, e.data.size='+e.data.size);
			chunks.push(e.data);
		};

		mediaRecorder.onerror = function(e){
			log('mediaRecorder.onerror: ' + e);
		};

		mediaRecorder.onstart = function(){
			log('mediaRecorder.onstart, mediaRecorder.state = ' + mediaRecorder.state);
			
			localStream.getTracks().forEach(function(track) {
              if(track.kind == "audio"){
                log("onstart - Audio track.readyState="+track.readyState+", track.muted=" + track.muted);
              }
              if(track.kind == "video"){
                log("onstart - Video track.readyState="+track.readyState+", track.muted=" + track.muted);
              }
            });
			
		};

		mediaRecorder.onstop = function(){
			log('mediaRecorder.onstop, mediaRecorder.state = ' + mediaRecorder.state);

			var blob = new Blob(chunks, {type: "video/webm"});
			chunks = [];

			var videoURL = window.URL.createObjectURL(blob);

			downloadLink.href = videoURL;
			videoElement.src = videoURL;
			downloadLink.innerHTML = 'Download video file';

			var rand =  Math.floor((Math.random() * 10000000));
			var name  = "video_"+rand+".webm" ;

			downloadLink.setAttribute( "download", name);
			downloadLink.setAttribute( "name", name);
		};

		mediaRecorder.onpause = function(){
			log('mediaRecorder.onpause, mediaRecorder.state = ' + mediaRecorder.state);
		}

		mediaRecorder.onresume = function(){
			log('mediaRecorder.onresume, mediaRecorder.state = ' + mediaRecorder.state);
		}

		mediaRecorder.onwarning = function(e){
			log('mediaRecorder.onwarning: ' + e);
		};

		pauseResBtn.textContent = "Pause";

		mediaRecorder.start(10);

		localStream.getTracks().forEach(function(track) {
			log(track.kind+":"+JSON.stringify(track.getSettings()));
			console.log(track.getSettings());
		})
	}
}

navigator.mediaDevices.ondevicechange = function(event) {
	log("mediaDevices.ondevicechange");
	/*
	if (localStream != null){
		localStream.getTracks().forEach(function(track) {
			if(track.kind == "audio"){
				track.onended = function(event){
					log("audio track.onended");
				}
			}
		});
	}
	*/
}

function onBtnStopClicked(){
	mediaRecorder.stop();
	videoElement.controls = true;
	recBtn.disabled = false;
	pauseResBtn.disabled = true;
	stopBtn.disabled = true;
}

function onPauseResumeClicked(){
	if(pauseResBtn.textContent === "Pause"){
		pauseResBtn.textContent = "Resume";
		mediaRecorder.pause();
		stopBtn.disabled = true;
	}else{
		pauseResBtn.textContent = "Pause";
		mediaRecorder.resume();
		stopBtn.disabled = false;
	}
	recBtn.disabled = true;
	pauseResBtn.disabled = false;
}

function onStateClicked(){
	
	if(mediaRecorder != null && localStream != null && soundMeter != null){
		log("mediaRecorder.state="+mediaRecorder.state);
		log("mediaRecorder.mimeType="+mediaRecorder.mimeType);
		log("mediaRecorder.videoBitsPerSecond="+mediaRecorder.videoBitsPerSecond);
		log("mediaRecorder.audioBitsPerSecond="+mediaRecorder.audioBitsPerSecond);

		localStream.getTracks().forEach(function(track) {
			if(track.kind == "audio"){
				log("Audio: track.readyState="+track.readyState+", track.muted=" + track.muted);
			}
			if(track.kind == "video"){
				log("Video: track.readyState="+track.readyState+", track.muted=" + track.muted);
			}
		});
		
		log("Audio activity: " + Math.round(soundMeter.instant.toFixed(2) * 100));
	}
	
}

function log(message){
	dataElement.innerHTML = dataElement.innerHTML+'<br>'+message ;
	console.log(message)
}

// Meter class that generates a number correlated to audio volume.
// The meter class itself displays nothing, but it makes the
// instantaneous and time-decaying volumes available for inspection.
// It also reports on the fraction of samples that were at or near
// the top of the measurement range.
function SoundMeter(context) {
  this.context = context;
  this.instant = 0.0;
  this.slow = 0.0;
  this.clip = 0.0;
  this.script = context.createScriptProcessor(2048, 1, 1);
  var that = this;
  this.script.onaudioprocess = function(event) {
	var input = event.inputBuffer.getChannelData(0);
	var i;
	var sum = 0.0;
	var clipcount = 0;
	for (i = 0; i < input.length; ++i) {
	  sum += input[i] * input[i];
	  if (Math.abs(input[i]) > 0.99) {
		clipcount += 1;
	  }
	}
	that.instant = Math.sqrt(sum / input.length);
	that.slow = 0.95 * that.slow + 0.05 * that.instant;
	that.clip = clipcount / input.length;
  };
}

SoundMeter.prototype.connectToSource = function(stream, callback) {
  console.log('SoundMeter connecting');
  try {
	this.mic = this.context.createMediaStreamSource(stream);
	this.mic.connect(this.script);
	// necessary to make sample run, but should not be.
	this.script.connect(this.context.destination);
	if (typeof callback !== 'undefined') {
	  callback(null);
	}
  } catch (e) {
	console.error(e);
	if (typeof callback !== 'undefined') {
	  callback(e);
	}
  }
};
SoundMeter.prototype.stop = function() {
  this.mic.disconnect();
  this.script.disconnect();
};


//browser ID
function getBrowser(){
	var nVer = navigator.appVersion;
	var nAgt = navigator.userAgent;
	var browserName  = navigator.appName;
	var fullVersion  = ''+parseFloat(navigator.appVersion);
	var majorVersion = parseInt(navigator.appVersion,10);
	var nameOffset,verOffset,ix;

	// In Opera, the true version is after "Opera" or after "Version"
	if ((verOffset=nAgt.indexOf("Opera"))!=-1) {
	 browserName = "Opera";
	 fullVersion = nAgt.substring(verOffset+6);
	 if ((verOffset=nAgt.indexOf("Version"))!=-1)
	   fullVersion = nAgt.substring(verOffset+8);
	}
	// In MSIE, the true version is after "MSIE" in userAgent
	else if ((verOffset=nAgt.indexOf("MSIE"))!=-1) {
	 browserName = "Microsoft Internet Explorer";
	 fullVersion = nAgt.substring(verOffset+5);
	}
	// In Chrome, the true version is after "Chrome"
	else if ((verOffset=nAgt.indexOf("Chrome"))!=-1) {
	 browserName = "Chrome";
	 fullVersion = nAgt.substring(verOffset+7);
	}
	// In Safari, the true version is after "Safari" or after "Version"
	else if ((verOffset=nAgt.indexOf("Safari"))!=-1) {
	 browserName = "Safari";
	 fullVersion = nAgt.substring(verOffset+7);
	 if ((verOffset=nAgt.indexOf("Version"))!=-1)
	   fullVersion = nAgt.substring(verOffset+8);
	}
	// In Firefox, the true version is after "Firefox"
	else if ((verOffset=nAgt.indexOf("Firefox"))!=-1) {
	 browserName = "Firefox";
	 fullVersion = nAgt.substring(verOffset+8);
	}
	// In most other browsers, "name/version" is at the end of userAgent
	else if ( (nameOffset=nAgt.lastIndexOf(' ')+1) <
		   (verOffset=nAgt.lastIndexOf('/')) )
	{
	 browserName = nAgt.substring(nameOffset,verOffset);
	 fullVersion = nAgt.substring(verOffset+1);
	 if (browserName.toLowerCase()==browserName.toUpperCase()) {
	  browserName = navigator.appName;
	 }
	}
	// trim the fullVersion string at semicolon/space if present
	if ((ix=fullVersion.indexOf(";"))!=-1)
	   fullVersion=fullVersion.substring(0,ix);
	if ((ix=fullVersion.indexOf(" "))!=-1)
	   fullVersion=fullVersion.substring(0,ix);

	majorVersion = parseInt(''+fullVersion,10);
	if (isNaN(majorVersion)) {
	 fullVersion  = ''+parseFloat(navigator.appVersion);
	 majorVersion = parseInt(navigator.appVersion,10);
	}


	return browserName;
}
