// Mobile delivery copies only. Preserve the source clips and their exact timing.
import Foundation
import AVFoundation

let root = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
let output = root.appendingPathComponent("web", isDirectory: true)
Task {
 do {
  try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
  for name in ["arrival", "idle-a", "idle-b", "smile", "praise", "completion"] {
   let destination = output.appendingPathComponent(name + ".mp4")
   if FileManager.default.fileExists(atPath: destination.path) {
    guard (try destination.resourceValues(forKeys:[.fileSizeKey]).fileSize ?? 0) > 10000 else { throw NSError(domain:"Invalid previous export; move it aside before retrying",code:5) }
    print("Preserved existing: \(name)"); continue
   }
   let asset = AVURLAsset(url: root.appendingPathComponent(name + ".mp4"))
   let duration = try await asset.load(.duration)
   guard let source = try await asset.loadTracks(withMediaType: .video).first else { throw NSError(domain:"No video",code:1) }
   let composition = AVMutableComposition()
   guard let track = composition.addMutableTrack(withMediaType:.video,preferredTrackID:kCMPersistentTrackID_Invalid) else { throw NSError(domain:"No track",code:2) }
   try track.insertTimeRange(CMTimeRange(start:.zero,duration:duration),of:source,at:.zero)
   track.preferredTransform = try await source.load(.preferredTransform)
   guard let exporter = AVAssetExportSession(asset:composition,presetName:AVAssetExportPreset960x540) else { throw NSError(domain:"No exporter",code:3) }
   exporter.shouldOptimizeForNetworkUse = true
   try await exporter.export(to:destination,as:.mp4)
   let check = AVURLAsset(url:destination)
   guard let video = try await check.loadTracks(withMediaType:.video).first else { throw NSError(domain:"No output video",code:4) }
   let size = try await video.load(.naturalSize)
   let bytes = try destination.resourceValues(forKeys:[.fileSizeKey]).fileSize ?? 0
   print("\(name): \(CMTimeGetSeconds(duration))s, \(size), \(bytes) bytes")
  }
  exit(0)
 } catch { print("Export failed: \(error)"); exit(1) }
}
dispatchMain()
