# How electric motors work

A standalone explainer with six benches. Open `index.html` in a browser; it
needs nothing from the network.

## The six benches

1. **A loop of wire in a magnet.** Force on each side of the loop, torque
   against angle, and why the current has to be reversed every half turn.
   Commutator on or off, one to three loops, brush gap and brush angle.
2. **The brushed DC motor.** Many coils and a commutator. Permanent-magnet,
   shunt or series field; steady DC, switched PWM or AC supply; stall, back-EMF,
   torque-speed line with the load curve and working point.
3. **The brushless motor.** Three phases with a floating star point. Six-step
   commutation from Hall sectors, sine drive locked to the rotor, or open loop
   that can fall out of step. Timing, pole count, back-EMF shape, cogging.
4. **The rotating field and the induction motor.** Three-phase stator and a
   squirrel cage. Disconnect phases, swap two, change frequency with or without
   constant V/f, change the rotor resistance; torque-speed curve and slip.
5. **The synchronous motor.** Load angle, pull-out, hunting, starting by
   frequency ramp or by damper cage, excitation and power factor, reluctance
   rotor.
6. **The stepper motor.** One-phase, two-phase, half and microstepping; chopper
   or plain resistor drive; ringing, ramps, lost steps.

Each bench has a cross-section view (drag the rotor to turn, hold or flick it),
a readout, a torque curve with the present working point, a scope, presets and
an animation-speed control. On "Auto" the animation is slowed so the rotor turns
about once every two seconds; the physics is not affected. 108 parameters in all.

## How it works

- Loop and brushed motor: torque constant from the coil geometry and the
  commutator's switching points; armature circuit with R, L, back-EMF and brush
  drop; field saturation as tanh for wound fields.
- Brushless: three phase currents, star point solved each step; in six-step the
  switched-off phase freewheels through its diode until its current is zero.
- Induction: per-phase equivalent circuit in Thévenin form, evaluated at the
  present slip; forward and backward sequence fields when phases are missing.
- Synchronous: torque from load angle with a reluctance term, a damper torque
  proportional to slip speed, and the swing equation.
- Stepper: two phase currents with L, R and back-EMF, sinusoidal torque
  constant, detent torque.
- Shaft: inertia, viscous drag, dry friction with sticking, and brake, linear
  or fan loads.

The page's last panel lists what is simplified or left out.

URL parameters for screenshots: `?only=<loop|dc|bldc|im|sy|st>` shows one bench,
`?preset=<n>` applies that bench's n-th preset, `?pump=<frames>` runs that many
frames before the first paint, `?slow=<factor|auto>` sets the animation speed.
`window.__em` exposes the benches (`__em.by('dc')`, `__em.pump('dc', 600)`).

## Tests

    node test.mjs

The physics is in the `shared-code` script block. The tests check it against
textbook results: no-load and stall values, power balance, pull-out slip and
torque, synchronous lock and load angle, step counts and lost steps.
