import { useMachineStore } from "@/stores/machine";

/** Used only while the object model reports no axis speeds (DWC's usual jog feedrate) */
const FALLBACK_FEEDRATE = 6000;

/**
 * Feedrate in mm/min that runs a move over the given axes at the machine's maximum speed. RRF
 * lowers a move's feedrate until no axis exceeds its M203 limit (`move.axes[].speed`, mm/min), so
 * the norm of the limits is high enough in every direction and the slowest axis sets the pace
 */
export function maxFeedrate(...letters: Array<string>): number {
	const axes = useMachineStore().model.move.axes;
	const speeds = letters.map((letter) => axes.find((axis) => axis.letter === letter)?.speed ?? 0);
	const feedrate = Math.ceil(Math.hypot(...speeds));
	return (feedrate > 0) ? feedrate : FALLBACK_FEEDRATE;
}
