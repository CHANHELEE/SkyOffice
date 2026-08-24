import Peer from 'peerjs'
import Network from '../services/Network'
import store from '../stores'
import { setCameraOn, setMicrophoneOn, setVideoConnected } from '../stores/UserStore'

export default class WebRTC {
  private myPeer: Peer
  private peers = new Map<string, { call: Peer.MediaConnection; video: HTMLVideoElement }>()
  private onCalledPeers = new Map<string, { call: Peer.MediaConnection; video: HTMLVideoElement }>()
  private videoGrid = document.querySelector('.video-grid')
  private myVideo = document.createElement('video')
  private myStream?: MediaStream
  /** sanitized ids of people who have told us their camera is off */
  private peerCameraOff = new Set<string>()
  private network: Network

  constructor(userId: string, network: Network) {
    const sanitizedId = this.replaceInvalidId(userId)
    this.myPeer = new Peer(sanitizedId)
    this.network = network
    console.log('userId:', userId)
    console.log('sanitizedId:', sanitizedId)
    this.myPeer.on('error', (err) => {
      console.log(err.type)
      console.error(err)
    })

    // mute your own video stream (you don't want to hear yourself)
    this.myVideo.muted = true

    // config peerJS
    this.initialize()
  }

  // PeerJS throws invalid_id error if it contains some characters such as that colyseus generates.
  // https://peerjs.com/docs.html#peer-id
  private replaceInvalidId(userId: string) {
    return userId.replace(/[^0-9a-z]/gi, 'G')
  }

  initialize() {
    this.myPeer.on('call', (call) => {
      if (!this.onCalledPeers.has(call.peer)) {
        call.answer(this.myStream)
        const video = document.createElement('video')
        this.onCalledPeers.set(call.peer, { call, video })

        call.on('stream', (userVideoStream) => {
          this.addVideoStream(video, userVideoStream, call.peer)
        })
      }
      // on close is triggered manually with deleteOnCalledVideoStream()
    })
  }

  // check if permission has been granted before
  checkPreviousPermission() {
    const permissionName = 'microphone' as PermissionName
    navigator.permissions?.query({ name: permissionName }).then((result) => {
      if (result.state === 'granted') this.getUserMedia(false)
    })
  }

  getUserMedia(alertOnError = true) {
    // ask the browser to get user media
    navigator.mediaDevices
      ?.getUserMedia({
        video: true,
        audio: true,
      })
      .then((stream) => {
        this.myStream = stream
        this.addVideoStream(this.myVideo, this.myStream)
        store.dispatch(setCameraOn(true))
        store.dispatch(setMicrophoneOn(true))
        store.dispatch(setVideoConnected(true))
        this.network.videoConnected()
      })
      .catch((error) => {
        if (alertOnError) window.alert('No webcam or microphone found, or permission is blocked')
      })
  }

  // method to call a peer
  connectToNewUser(userId: string) {
    if (this.myStream) {
      const sanitizedId = this.replaceInvalidId(userId)
      if (!this.peers.has(sanitizedId)) {
        console.log('calling', sanitizedId)
        const call = this.myPeer.call(sanitizedId, this.myStream)
        const video = document.createElement('video')
        this.peers.set(sanitizedId, { call, video })

        call.on('stream', (userVideoStream) => {
          this.addVideoStream(video, userVideoStream, sanitizedId)
        })

        // on close is triggered manually with deleteVideoStream()
      }
    }
  }

  // method to add new video stream to videoGrid div
  addVideoStream(video: HTMLVideoElement, stream: MediaStream, peerId?: string) {
    video.srcObject = stream
    video.playsInline = true
    video.addEventListener('loadedmetadata', () => {
      video.play()
    })
    this.hideTileWhileCameraIsOff(video, peerId)
    if (this.videoGrid) this.videoGrid.append(video)
  }

  /**
   * A tile with nobody behind it is worse than no tile at all: it freezes on
   * whatever frame arrived last, so someone who turned their camera off is left
   * on other people's screens, still sitting there.
   *
   * Two things can hide it. A stream with no video track at all - they were
   * already off when the call was made - and word from the person themselves,
   * which is what setPeerCameraOn brings. The browser is no help here:
   * replaceTrack(null) leaves the receiving track live and unmuted, so waiting
   * for a mute event waits forever. The mute listeners are still worth having
   * for the cases the browser does report.
   */
  private hideTileWhileCameraIsOff(video: HTMLVideoElement, peerId?: string) {
    const sync = () => this.syncTile(video, peerId)
    const stream = video.srcObject as MediaStream | null

    stream?.getVideoTracks().forEach((track) => {
      track.addEventListener('mute', sync)
      track.addEventListener('unmute', sync)
      track.addEventListener('ended', sync)
    })
    stream?.addEventListener('addtrack', sync)
    stream?.addEventListener('removetrack', sync)
    sync()
  }

  private syncTile(video: HTMLVideoElement, peerId?: string) {
    const stream = video.srcObject as MediaStream | null
    const track = stream?.getVideoTracks()[0]
    const theirCameraIsOff = peerId !== undefined && this.peerCameraOff.has(peerId)
    video.style.display = track && !track.muted && !theirCameraIsOff ? '' : 'none'
  }

  /** someone said their camera went on or off - show or hide their tile */
  setPeerCameraOn(userId: string, on: boolean) {
    const id = this.replaceInvalidId(userId)
    if (on) this.peerCameraOff.delete(id)
    else this.peerCameraOff.add(id)

    const entry = this.peers.get(id) ?? this.onCalledPeers.get(id)
    if (entry) this.syncTile(entry.video, id)
  }

  // method to remove video stream (when we are the host of the call)
  deleteVideoStream(userId: string) {
    const sanitizedId = this.replaceInvalidId(userId)
    if (this.peers.has(sanitizedId)) {
      const peer = this.peers.get(sanitizedId)
      peer?.call.close()
      peer?.video.remove()
      this.peers.delete(sanitizedId)
    }
  }

  // method to remove video stream (when we are the guest of the call)
  deleteOnCalledVideoStream(userId: string) {
    const sanitizedId = this.replaceInvalidId(userId)
    if (this.onCalledPeers.has(sanitizedId)) {
      const onCalledPeer = this.onCalledPeers.get(sanitizedId)
      onCalledPeer?.call.close()
      onCalledPeer?.video.remove()
      this.onCalledPeers.delete(sanitizedId)
    }
  }

  /**
   * Hand the outgoing video over to every call already in progress.
   *
   * Each call keeps a transceiver per kind, so the video one is still there
   * after the track is gone - which is why this looks for it by the receiving
   * side. Looking at sender.track would find nothing once it has been cleared,
   * and there would be no way back.
   */
  private sendVideoToPeers(track: MediaStreamTrack | null) {
    const calls = [...this.peers.values(), ...this.onCalledPeers.values()]
    calls.forEach(({ call }) => {
      const transceiver = call.peerConnection
        ?.getTransceivers()
        .find((t) => (t.sender.track ?? t.receiver.track)?.kind === 'video')
      transceiver?.sender.replaceTrack(track)
    })
  }

  /**
   * Camera off means the camera is off.
   *
   * Merely disabling the track sends black frames while the device stays open
   * and the little light stays on, which is not what anyone means by turning
   * their camera off in a study room. So the track is stopped and released,
   * and turning it back on asks the browser for a fresh one and hands that to
   * every call in progress - no renegotiation, replaceTrack does it in place.
   */
  async toggleCamera() {
    if (!this.myStream) return

    const existing = this.myStream.getVideoTracks()[0]
    if (existing) {
      existing.stop()
      this.myStream.removeTrack(existing)
      this.sendVideoToPeers(null)
      this.myVideo.srcObject = this.myStream
      // removeTrack() from script raises no event, so my own tile is told directly
      this.myVideo.style.display = 'none'
      this.network.sendCameraState(false)
      store.dispatch(setCameraOn(false))
      return
    }

    try {
      const fresh = await navigator.mediaDevices.getUserMedia({ video: true })
      const track = fresh.getVideoTracks()[0]
      this.myStream.addTrack(track)
      this.sendVideoToPeers(track)
      this.myVideo.srcObject = this.myStream
      this.myVideo.style.display = ''
      this.network.sendCameraState(true)
      store.dispatch(setCameraOn(true))
    } catch (error) {
      // the camera was released, so getting it back can fail - a device in use
      // elsewhere, or permission withdrawn since
      console.error('could not turn the camera back on:', error)
      window.alert('카메라를 다시 켜지 못했습니다. 다른 프로그램이 사용 중인지 확인해 주세요.')
    }
  }

  /**
   * The microphone only gets muted, not released.
   *
   * Unmuting has to be instant - people talk over the gap - and an open
   * microphone has no light to give anyone the wrong idea.
   */
  toggleMicrophone() {
    const track = this.myStream?.getAudioTracks()[0]
    if (!track) return
    track.enabled = !track.enabled
    store.dispatch(setMicrophoneOn(track.enabled))
  }
}
