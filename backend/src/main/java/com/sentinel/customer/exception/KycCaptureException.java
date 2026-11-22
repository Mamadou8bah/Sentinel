package com.sentinel.customer.exception;

import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

/** Only allowlisted capture diagnostics may cross the inference boundary. */
public class KycCaptureException extends ResponseStatusException {
    private static final Map<String, String> MESSAGES = Map.ofEntries(
        Map.entry("DOCUMENT_NO_FACE", "The portrait on your document could not be found. Photograph the photo side clearly, with all edges visible."),
        Map.entry("DOCUMENT_MULTIPLE_FACES", "More than one portrait was detected in the document photo. Use a clear photo of the document alone."),
        Map.entry("DOCUMENT_BLURRED", "The portrait on your document is not sharp enough. Retake the document photo in good light, without glare."),
        Map.entry("DOCUMENT_POSITION", "The document portrait is too small or cut off. Move closer while keeping the whole document visible."),
        Map.entry("DOCUMENT_INVALID", "The document photo could not be read. Choose a clear JPEG, PNG or WebP photo up to 5 MB."),
        Map.entry("VIDEO_NO_FACE", "Your face could not be detected throughout the video. Make only a small head turn and keep both eyes visible in the frame."),
        Map.entry("VIDEO_MULTIPLE_FACES", "More than one face appeared in the video. Record again with only you in view."),
        Map.entry("VIDEO_BLURRED", "The video did not contain enough sharp face images. Use brighter light, turn slowly and hold each pose."),
        Map.entry("VIDEO_POSITION", "Your face was too small or partly outside the video. Keep your whole face inside the frame."),
        Map.entry("VIDEO_TRACK_CHANGED", "The face position changed too abruptly. Keep the phone still and turn your head slowly."),
        Map.entry("VIDEO_TIMING", "The recording timing could not be read as one continuous nine-second video. Keep this page open and record again."),
        Map.entry("VIDEO_POSE", "The three held poses could not be confirmed. Look straight first, then turn slightly to your own left or right as prompted and hold each pose."),
        Map.entry("VIDEO_INVALID", "The video could not be read. Record it again using this page."));

    private final String code;
    private final String retryFrom;

    public KycCaptureException(String candidate) {
        super(HttpStatus.UNPROCESSABLE_ENTITY, MESSAGES.getOrDefault(candidate,
                "The captures could not be processed. Review your document photo and face video before trying again."));
        code = MESSAGES.containsKey(candidate) ? candidate : "CAPTURE_INVALID";
        retryFrom = code.startsWith("DOCUMENT_") ? "document" : code.startsWith("VIDEO_") ? "recording" : "review";
    }
    public String getCode() { return code; }
    public String getRetryFrom() { return retryFrom; }
}
