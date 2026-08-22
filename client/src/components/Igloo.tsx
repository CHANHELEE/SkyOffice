import React, { useMemo } from 'react'

/**
 * A drawn igloo.
 *
 * The blocks are the whole point, and they cannot be faked with repeating
 * gradients: real courses follow the curve of the dome, get shorter as they
 * climb, and stagger their joints against the course below. So the geometry is
 * computed and emitted as SVG paths.
 *
 * Decorative only, so it is hidden from assistive tech.
 */

const WIDTH = 420
const HEIGHT = 400
const CX = WIDTH / 2
const BASE_Y = 346
const RADIUS = 196

/** how far up the dome each course sits, as a fraction of the radius */
const COURSES = [0, 0.15, 0.31, 0.48, 0.65, 0.81, 0.93]

/** target width of a block at the base - courses fit whole blocks into their arc */
const BLOCK_WIDTH = 62

type Course = {
  y: number
  halfWidth: number
  /** the seam line along the top of this course */
  arc: string
}

function courseAt(fraction: number): Course {
  const rise = RADIUS * fraction
  const y = BASE_Y - rise
  // the dome is a circle, so the course narrows the higher it goes
  const halfWidth = Math.sqrt(Math.max(RADIUS * RADIUS - rise * rise, 0))
  // bow the seam upward in the middle so the course reads as wrapping around
  const bow = halfWidth * 0.16
  const arc = `M ${CX - halfWidth} ${y} Q ${CX} ${y - bow} ${CX + halfWidth} ${y}`
  return { y, halfWidth, arc }
}

/** height of the bowed seam at a given horizontal offset, so joints meet it */
function seamY(course: Course, x: number) {
  const t = (x - (CX - course.halfWidth)) / (course.halfWidth * 2)
  const bow = course.halfWidth * 0.16
  return course.y - bow * 2 * t * (1 - t)
}

export default function Igloo() {
  const { courses, joints } = useMemo(() => {
    const built = COURSES.map(courseAt)
    const jointPaths: string[] = []

    // joints live in the band between one course and the next, staggered each row
    for (let i = 0; i < built.length - 1; i++) {
      const lower = built[i]
      const upper = built[i + 1]
      const span = Math.min(lower.halfWidth, upper.halfWidth) * 2
      const count = Math.max(2, Math.round(span / BLOCK_WIDTH))
      const stagger = i % 2 === 0 ? 0.5 : 0

      for (let b = 0; b <= count; b++) {
        const t = (b + stagger) / count
        if (t <= 0.02 || t >= 0.98) continue
        const xLower = CX - lower.halfWidth + t * lower.halfWidth * 2
        const xUpper = CX - upper.halfWidth + t * upper.halfWidth * 2
        jointPaths.push(
          `M ${xLower.toFixed(1)} ${seamY(lower, xLower).toFixed(1)} L ${xUpper.toFixed(1)} ${seamY(
            upper,
            xUpper
          ).toFixed(1)}`
        )
      }
    }

    return { courses: built, joints: jointPaths }
  }, [])

  const dome = `M ${CX - RADIUS} ${BASE_Y} A ${RADIUS} ${RADIUS} 0 0 1 ${CX + RADIUS} ${BASE_Y} Z`

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      height="100%"
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMidYMax meet"
    >
      <defs>
        {/* sun from the upper left, blue shade collecting on the lower right */}
        <linearGradient id="igloo-snow" x1="0.18" y1="0" x2="0.82" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.46" stopColor="#f4fbff" />
          <stop offset="1" stopColor="#c9e2f4" />
        </linearGradient>

        {/* the dome is round, so the light falls off toward the silhouette */}
        <radialGradient id="igloo-form" cx="0.34" cy="0.26" r="0.85">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#7fb2d4" stopOpacity="0.38" />
        </radialGradient>

        <linearGradient id="igloo-tunnel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d3e7f6" />
        </linearGradient>

        <radialGradient id="igloo-doorway" cx="0.5" cy="0.9" r="0.75">
          <stop offset="0" stopColor="#9dc2da" />
          <stop offset="1" stopColor="#c2dcee" />
        </radialGradient>

        <linearGradient id="igloo-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e8f4fd" />
        </linearGradient>
      </defs>

      {/* shadow the dome casts onto the snow, thrown away from the sun */}
      <ellipse cx={CX + 26} cy={BASE_Y + 12} rx={RADIUS * 1.02} ry="26" fill="#7fb2d4" opacity="0.24" />

      {/* the ground it stands on */}
      <ellipse cx={CX} cy={BASE_Y + 6} rx={RADIUS * 1.16} ry="30" fill="url(#igloo-ground)" />

      {/* dome */}
      <path d={dome} fill="url(#igloo-snow)" />

      {/* block seams - low contrast, the way snow joints look in flat daylight */}
      <g stroke="#8fbdd8" strokeOpacity="0.5" strokeWidth="1.6" strokeLinecap="round" fill="none">
        {courses.slice(1).map((course, i) => (
          <path key={`course-${i}`} d={course.arc} />
        ))}
        {joints.map((d, i) => (
          <path key={`joint-${i}`} d={d} />
        ))}
      </g>

      {/* a second, lighter seam just under each one, so the blocks read as thick */}
      <g stroke="#ffffff" strokeOpacity="0.85" strokeWidth="1.4" fill="none">
        {courses.slice(1).map((course, i) => (
          <path key={`highlight-${i}`} d={course.arc} transform="translate(0 2.2)" />
        ))}
      </g>

      {/* round the dome off with light */}
      <path d={dome} fill="url(#igloo-form)" />

      {/* snow banked against the base, behind the tunnel */}
      <path
        d={`M ${CX - RADIUS - 20} ${BASE_Y + 8}
            Q ${CX - RADIUS * 0.5} ${BASE_Y - 14} ${CX - 74} ${BASE_Y + 12}
            L ${CX + 74} ${BASE_Y + 12}
            Q ${CX + RADIUS * 0.55} ${BASE_Y - 16} ${CX + RADIUS + 20} ${BASE_Y + 8}
            L ${CX + RADIUS + 20} ${BASE_Y + 34} L ${CX - RADIUS - 20} ${BASE_Y + 34} Z`}
        fill="#ffffff"
        opacity="0.9"
      />

      {/* the entrance tunnel, sticking out toward you */}
      <g>
        <path
          d={`M ${CX - 66} ${BASE_Y + 12} A 66 62 0 0 1 ${CX + 66} ${BASE_Y + 12} Z`}
          fill="url(#igloo-tunnel)"
          stroke="#8fbdd8"
          strokeOpacity="0.45"
          strokeWidth="1.4"
        />
        <g stroke="#8fbdd8" strokeOpacity="0.4" strokeWidth="1.3" fill="none">
          <path d={`M ${CX - 44} ${BASE_Y - 22} L ${CX - 38} ${BASE_Y + 12}`} />
          <path d={`M ${CX + 44} ${BASE_Y - 22} L ${CX + 38} ${BASE_Y + 12}`} />
          <path d={`M ${CX - 50} ${BASE_Y - 14} Q ${CX} ${BASE_Y - 38} ${CX + 50} ${BASE_Y - 14}`} />
        </g>

        {/* the opening, with somebody leaning out of it */}
        <path
          d={`M ${CX - 38} ${BASE_Y + 12} A 38 38 0 0 1 ${CX + 38} ${BASE_Y + 12} Z`}
          fill="url(#igloo-doorway)"
        />
        <g>
          <ellipse cx={CX} cy={BASE_Y + 4} rx="24" ry="25" fill="#ffffff" />
          <circle cx={CX - 8} cy={BASE_Y - 4} r="3.4" fill="#6e9cbd" />
          <circle cx={CX + 8} cy={BASE_Y - 4} r="3.4" fill="#6e9cbd" />
          <path
            d={`M ${CX - 6} ${BASE_Y + 6} Q ${CX} ${BASE_Y + 11} ${CX + 6} ${BASE_Y + 6}`}
            fill="none"
            stroke="#6e9cbd"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <circle cx={CX - 16} cy={BASE_Y + 4} r="3.6" fill="#ffd3dc" />
          <circle cx={CX + 16} cy={BASE_Y + 4} r="3.6" fill="#ffd3dc" />
        </g>
        <path
          d={`M ${CX - 38} ${BASE_Y + 12} A 38 38 0 0 1 ${CX + 38} ${BASE_Y + 12}`}
          fill="none"
          stroke="#8fbdd8"
          strokeOpacity="0.55"
          strokeWidth="1.6"
        />
      </g>

      {/* flag on the crown */}
      <g>
        <path
          d={`M ${CX} ${BASE_Y - RADIUS + 6} L ${CX} ${BASE_Y - RADIUS - 46}`}
          stroke="#f3cf8e"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <circle cx={CX} cy={BASE_Y - RADIUS - 50} r="5" fill="#f3cf8e" />
        <path
          d={`M ${CX + 2} ${BASE_Y - RADIUS - 44}
              L ${CX + 44} ${BASE_Y - RADIUS - 44}
              L ${CX + 35} ${BASE_Y - RADIUS - 31}
              L ${CX + 44} ${BASE_Y - RADIUS - 18}
              L ${CX + 2} ${BASE_Y - RADIUS - 18} Z`}
          fill="#8fcbeb"
          stroke="#a3c9e4"
          strokeWidth="2.6"
          strokeLinejoin="round"
        />
        <path
          d={`M ${CX + 19} ${BASE_Y - RADIUS - 35}
              c -2 -3.3 -6.9 -2.7 -6.9 1.2
              c 0 2.9 3.9 5.4 6.9 7.5
              c 3 -2.1 6.9 -4.6 6.9 -7.5
              c 0 -3.9 -4.9 -4.5 -6.9 -1.2 Z`}
          fill="#ffffff"
        />
      </g>
    </svg>
  )
}
