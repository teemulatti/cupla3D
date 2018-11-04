/** Cupla 3D Library - copyright (c) Teemu Lätti 2012-2018 */

var Cupla3D = {

	canvas: null,
	context: null,
	camera: null,
	obes: [],
	planes: [],
	opaque: 1,

	/** Initialize 3D library */
	init: function(canvas) {
	    // Canvas
	    this.canvas = canvas;
    	this.context = canvas.getContext("2d");
	    if (!this.context) {
	        return false;
	    }

	    // Static transformation so that y goes up and origin is in the middle of canvas
	    this.context.setTransform(1, 0, 0, -1, this.context.canvas.width / 2, this.context.canvas.height / 2, 0);

	    // Camera
	    this.camera = new Cupla3D.Camera();

	    return true;
	},

	/** Starts 3D timer */
	start: function(preCallbackFunc, postCallbackFunc) {
		// Make sure some sort of requestAnimationFrame() is supported
		window.requestAnimFrame = window.requestAnimationFrame ||
			window.webkitRequestAnimationFrame ||
			window.mozRequestAnimationFrame ||
			function(callback) {
				window.setTimeout(callback, 1000 / 60);
			};

	    this.do3DTimerFunc(preCallbackFunc, postCallbackFunc);
	},

	do3DTimerFunc: function(preCallbackFunc, postCallbackFunc) {
	    // Next
	    setTimeout(function() {
	        requestAnimFrame(function() { Cupla3D.do3DTimerFunc(preCallbackFunc, postCallbackFunc); });
	    }, 30);

	    // User callback (pre)
	    if (preCallbackFunc) {
	        preCallbackFunc();
	    }

	    // Timer tick for all objects
	    for (i in this.obes) {
	        this.obes[i].timer();
	    }

	    // Draw 3D world
	    this.draw();

	    // User callback (post)
	    if (postCallbackFunc) {
	        postCallbackFunc();
	    }
	},

	/** Clears canvas */
	clear: function() {
        this.context.save();
        this.context.setTransform(1, 0, 0, 1, 0, 0);
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.context.restore();
	},

	/** Draws 3D world */
	draw: function() {
	    // Clear projections from all points
	    for (i in this.obes) {
	        var obe = this.obes[i];
	        for (j in obe.pnts) {
	            obe.pnts[j].clearProjection();
	        }
	    }

	    // Collect planes from all objects
	    this.planes = [];
	    for (i in this.obes) {
	        var obe = this.obes[i];
	        for (j in obe.planes) {
	            var plane = obe.planes[j];

	            var add = false;
	            if (plane.facing && plane.pnts.length >= 3) {
	                // Check that facing front
	                plane.pnts[0].project();
	                plane.pnts[1].project();
	                plane.pnts[2].project();
	                var v1 = new Vector(plane.pnts[0].pnt2D, plane.pnts[1].pnt2D);
	                var v2 = new Vector(plane.pnts[1].pnt2D, plane.pnts[2].pnt2D);
	                var a1 = v1.angle();
	                var a2 = v2.angle();
	                a2 -= a1;
	                if ((a2 > -Math.PI && a2 < 0) || a2 > Math.PI) {
	                    add = true;
	                }
	            } else {
	                // Facing not required => add always
	                add = true;
	            }

	            if (add) {
	                this.planes.push(plane);
	            }
	        }
	    }

	    // Pre-calculate plane centers for sorting
	    for (i in this.planes) {
	        this.planes[i].z_ = this.planes[i].center().z;
	    }

	    // Sort planes to z-order, back first
	    this.planes.sort(function(a, b) { return (b.z_ - a.z_); });

	    // Make sure all points have been projected (not only the ones that were needed above),
	    // and check all planes that they can be drawn
	    var planes2 = this.planes;
	    this.planes = [];
	    for (i in planes2) {
	        var ok = true;
	        var plane = planes2[i];
	        for (k in plane.pnts) {
	            if (!plane.pnts[k].project()) {
	                ok = false; // projection failed => forget plane
	                break;
	            }
	        }
	        if (ok) {
	            this.planes.push(plane);
	        }
	    }

	    // Clear (just before drawing instead of before calculations)
	    this.clear();

	    // Draw all planes, back first
	    for (i in this.planes) {
	        this.planes[i].draw(this.context);
	    }

	    // Done drawing, so clear calculated planes
	    this.planes = [];
	},

	/** class Camera extends ObePnt */
	Camera: function() {
	    Cupla3D.ObePnt.call(this, 0, 0, -600, null); // ObePnt as camera position
	},

	/** class Pnt */
	Pnt: function(x, y, z) {

	    this.x = x;	// [int] 3D point
	    this.y = y;
	    this.z = z;

	    /** Moves point to specified position */
	    this.moveTo = function(x, y, z) {
	        this.x = x;
	        this.y = y;
	        this.z = z;
	    };

	    /** Moves point relative to current position */
	    this.move = function(dx, dy, dz) {
	        this.x += dx;
	        this.y += dy;
	        this.z += dz;
	    };

	    /** Scales point position by multi */
	    this.scale = function(mul) {
	        this.x *= mul;
	        this.y *= mul;
	        this.z *= mul;
	    };

	    /** Turns point relative to origin (degrees) */
	    this.turn = function(ax, ay, az) {
	        var arx = Cupla3D.deg2rad(ax);
	        var ary = Cupla3D.deg2rad(ay);
	        var arz = Cupla3D.deg2rad(az);

	        // Turn x
	        if (arx != 0) {
	            var y = this.y * Math.cos(arx) - this.z * Math.sin(arx);
	            var z = this.y * Math.sin(arx) + this.z * Math.cos(arx);
	            this.y = y;
	            this.z = z;
	        }

	        // Turn y
	        if (ary != 0) {
	            var z = this.z * Math.cos(ary) - this.x * Math.sin(ary);
	            var x = this.z * Math.sin(ary) + this.x * Math.cos(ary);
	            this.z = z;
	            this.x = x;
	        }

	        // Turn z
	        if (arz != 0) {
	            var x = this.x * Math.cos(arz) - this.y * Math.sin(arz);
	            var y = this.x * Math.sin(arz) + this.y * Math.cos(arz);
	            this.x = x;
	            this.y = y;
	        }
	    };

	    this.length = function() {
	        return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.z, 2)); //!!!! y not counted
	    };
	},

	/** class ObePnt extends Pnt */
	ObePnt: function(x, y, z, parent) {
	    Cupla3D.Pnt.call(this, x, y, z);  // [Pnt] point relative to parent

	    this.parent = parent;             // [Obe] Parent object
	    this.pnt2D = null;                // [Pnt] Projected 2D point (+z) as absolute point

	    /** Gets absolute point (not relative to parent). Returns Pnt */
	    this.getAbsolutePnt = function() {
	        var pnt3d = new Cupla3D.Pnt(this.x, this.y, this.z);
	        if (this.parent) {
	            var parentpnt = this.parent.getAbsolutePnt();
	            pnt3d.x += parentpnt.x;
	            pnt3d.y += parentpnt.y;
	            pnt3d.z += parentpnt.z;
	        }
	        return pnt3d;
	    };

	    /** Projects point to 2D (if not projected yet) */
	    this.project = function(force) {
	        if (this.pnt2D == null || force) { //! calculates invalid twice?
	            // Project point from 3D to 2D

	            // Real absolute point (3D)
	            var pnt3d = this.getAbsolutePnt();

	            // Take camera position into account BEFORE projection
	            // so perspective depends how the point is in relation to camera
	            pnt3d.x -= Cupla3D.camera.x;
	            pnt3d.y -= Cupla3D.camera.y;
	            pnt3d.z -= Cupla3D.camera.z;

	            // Projection by distance to 2D (simplified)
	            //! old: var z = 1 + (pnt3d.z / 600);
	            var div = pnt3d.z / 600; //! magic number?
	            if (div != 0) {
	                this.pnt2D = new Cupla3D.Pnt(pnt3d.x / div, pnt3d.y / div, div);
	            } else {
	                this.pnt2D = new Cupla3D.Pnt(pnt3d.x, pnt3d.y, div);
	            }

	            // This is fake tilting //!?
	            this.pnt2D.y += Cupla3D.camera.y;
	        }
	        return (this.pnt2D.z > 0);
	    };

	    /** Clears projection */
	    this.clearProjection = function() {
	        this.pnt2D = null;
	    };

	    /** Rotates point == does nothing (overridden in derived classes) */
	    this.rotate = function(ax, ay, az) {
	    };
	},

	/** class Plane */
	Plane: function(fillStyle, lineStyle, lineWidth) {

	    this.pnts = [];                 // [ObePnt] Plane points in clock-wise order, relative to parent
	    this.facing = true;             // If true, plane facing will be checked before drawing
	    this.fill = true;               // Fill?
	    this.fillStyle = fillStyle;     // Fill style (color) or null==white
	    this.lineStyle = lineStyle;     // Line style (color) or null=darkGray
	    this.lineWidth = lineWidth;     // Line width or null==3

	    /** Plane draw method that should be overridden or use this default */
	    this.draw = function(ctx) {
	        // Fill
	        if (this.fill) {
	            if (this.fillStyle) {
	                ctx.fillStyle = this.fillStyle;
	            } else {
	                ctx.fillStyle = "rgba(255,255,255," + Cupla3D.opaque + ")";  // #ff == 255
	            }
	            ctx.beginPath();
	            var pnt = this.pnts[this.pnts.length - 1].pnt2D;
	            ctx.moveTo(pnt.x, pnt.y);
	            for (k in this.pnts) {
	                pnt = this.pnts[k].pnt2D;
	                ctx.lineTo(pnt.x, pnt.y);
	            }
	            ctx.fill();
	        }

	        // Lines
	        var lineWidth;
	        if (this.lineWidth) {
	            lineWidth = this.lineWidth;
	        } else {
	            lineWidth = 3;
	        }
	        var div = (this.pnts[0].pnt2D.z * 1.5); //! to method
	        if (div > 1) {
	            lineWidth /= div;
	        }
	        ctx.lineWidth = lineWidth;
	        if (this.lineStyle) {
	            ctx.strokeStyle = this.lineStyle;
	        } else {
	            ctx.strokeStyle = "rgba(170,170,170," + Cupla3D.opaque + ")"; // #aa == 170
	        }
	        var prev = this.pnts[this.pnts.length - 1].pnt2D;
	        for (k in this.pnts) {
	            var pnt = this.pnts[k].pnt2D;
	            Cupla3D.context.Line(prev.x, prev.y, pnt.x, pnt.y);
	            prev = pnt;
	        }
	    }

	    /** Determines plane center (absolute) */
	    this.center = function() {
	        if (this.pnts.length == 1) {
	            // Only one point => center it is
	            return this.pnts[0].getAbsolutePnt();
	        } else {
	            var arr = [];
	            for (i in this.pnts) {
	                arr.push(this.pnts[i].getAbsolutePnt());
	            }
	            return centerFromArray(arr);
	        }
	    };

	    /** Adds point to plane */
	    this.addPnt = function(/* ObePnt */ pnt) {
	        this.pnts.push(pnt);
	    };

	    /** Moves plane == moves points */
	    this.move = function(dx, dy, dz) {
	        for (i in this.pnts) {
	            this.pnts[i].move(dx, dy, dz);
	        }
	    };

	    /** Scales plane == scales points */
	    this.scale = function(mul) {
	        for (i in this.pnts) {
	            this.pnts[i].scale(mul);
	        }
	    };

	    /** Rotates plane == turns points */
	    this.rotate = function(ax, ay, az) {
	        for (i in this.pnts) {
	            this.pnts[i].turn(ax, ay, az);
	        }
	    };
	},

	// class Obe extends ObePnt
	Obe: function() {
	    Cupla3D.ObePnt.call(this, 0, 0, 0, null);    // ObePnt as object origin relative to parent object

	    this.pnts = [];          // [ObePnt] Object points (relative to object origin)
	    this.planes = [];        // [Plane] Object planes (made out of object points)
	    this.speed3D = null;     // [Pnt] Speed vector
	    this.rotation3D = null;  // [ObePnt] Rotation angles
	    this.turn3D = null;      // [Pnt] Turn angles

	    /** Adds new point position to this object */
	    this.addPnt = function(x, y, z) {
	        var pnt = new Cupla3D.ObePnt(x, y, z, this);
	        this.pnts.push(pnt);
	        return pnt;
	    };

	    /** Adds object as our child */
	    this.addObe = function(obe) {
	        obe.parent = this;              // objects parent is this
	        this.pnts.push(obe);            // add as a point, so it will be transformed as any other point
	    };

	    /** Adds plane to object */
	    this.addPlane = function(plane) {
	        this.planes.push(plane);
	    };

	    /** Determines object center (absolute) */
	    this.center = function() {
	        var arr = [];
	        for (i in this.pnts) {
	            arr.push(this.pnts[i].getAbsolutePnt());
	        }
	        return centerFromArray(arr);
	    };

	    /** Scales object == scales points by multi */
	    this.scale = function(mul) {
	        for (i in this.pnts) {
	            this.pnts[i].scale(mul);
	        }
	    };

	    /** Rotates object == turns+rotates points (they can be child-objects) */
	    this.rotate = function(ax, ay, az) {
	        for (i in this.pnts) {
	            this.pnts[i].turn(ax, ay, az);
	            this.pnts[i].rotate(ax, ay, az);
	        }
	    };

	    /** Sets constant speed */
	    this.setSpeed = function(x, y, z) {
	        this.speed3D = new Cupla3D.Pnt(x, y, z);
	    };

	    /** Sets constant turn (rotation around origin) */
	    this.setTurn = function(tx, ty, tz) {
	        this.turn3D = new Cupla3D.Pnt(tx, ty, tz);
	    };

	    /** Sets constant rotation (around itself) */
	    this.setRotate = function(ax, ay, az) {
	        this.rotation3D = new Cupla3D.Pnt(ax, ay, az);
	    };

	    /** Timer tick */
	    this.timer = function() {
	        // Apply speed
	        if (this.speed3D) {
	            this.move(this.speed3D.x, this.speed3D.y, this.speed3D.z);
	        }

	        // Apply turn
	        if (this.turn3D) {
	            this.turn(this.turn3D.x, this.turn3D.y, this.turn3D.z);
	        }

	        // Apply rotation
	        if (this.rotation3D) {
	            this.rotate(this.rotation3D.x, this.rotation3D.y, this.rotation3D.z);
	        }
	    };

	    // Automatically add this object to 3D objects
	    Cupla3D.obes.push(this);
	},

	/** class Curve extends Obe */
	Curve: function(a1, a2, a3) {
	    Cupla3D.Obe.call(this);

	    var p1 = this.addPnt(a1.x, a1.y, a1.z);
	    var p2 = this.addPnt(a2.x, a2.y, a2.z); //! this point should be modified to be double
	    var mul = 1.3; //!?
	    p2.scale(mul, mul, mul);
	    var p3 = this.addPnt(a3.x, a3.y, a3.z);

	    var plane = new Cupla3D.Plane();
	    plane.facing = false; //! stupid
	    plane.addPnt(p1);
	    plane.addPnt(p2);
	    plane.addPnt(p3);

	    var that = this;
	    plane.draw = function(ctx) {
	        ctx.strokeStyle = "rgba(210,210,210," + Cupla3D.opaque + ")";
	        ctx.beginPath();
	        ctx.moveTo(p1.pnt2D.x, p1.pnt2D.y);
	        ctx.quadraticCurveTo(p2.pnt2D.x, p2.pnt2D.y, p3.pnt2D.x, p3.pnt2D.y);
	        ctx.stroke();
	    };

	    this.addPlane(plane);
	},

	/** class Dot extends Obe */
	Dot: function(size, fillStyle) {
	    Cupla3D.Obe.call(this);

	    this.size      = (size) ? size : 2;  // size of dot
	    this.fillStyle = fillStyle;          // Fill style (color) or null==gray

	    // Add plane that has the object point as the only point
	    var plane = new Cupla3D.Plane();
	    plane.addPnt(this);
	    plane.facing = false;
	    this.addPlane(plane);

	    // Override plane drawing
	    var that = this;
	    plane.draw = function(ctx) {
	        var p = that.pnt2D;
	        ctx.beginPath();
	        if (that.fillStyle) {
	            ctx.fillStyle = that.fillStyle;
	        } else {
	            ctx.fillStyle = "rgba(170,170,170," + Cupla3D.opaque + ")"; // #aa == 170
	        }
	        ctx.strokeStyle = ctx.fillStyle;
	        var size = that.size;
	        var div = (this.pnts[0].pnt2D.z * 1.5); //! to method
	        size /= div;
	        ctx.arc(p.x, p.y, size, 0, 2 * Math.PI, false);
	        ctx.fill();
	    };
	},

	/** class Cube extends Obe */
	Cube: function(size,fillStyle,lineStyle,lineWidth) {
	    Cupla3D.Obe.call(this);

	    // Points
	    var p0 = this.addPnt(-1, -1, -1);   // left  - top    - front
	    var p1 = this.addPnt(+1, -1, -1);   // right - top    - front
	    var p2 = this.addPnt(+1, +1, -1);   // right - bottom - front
	    var p3 = this.addPnt(-1, +1, -1);   // left  - bottom - front
	    var p4 = this.addPnt(-1, -1, +1);   // left  - top    - back
	    var p5 = this.addPnt(+1, -1, +1);   // right - top    - back
	    var p6 = this.addPnt(+1, +1, +1);   // right - bottom - back
	    var p7 = this.addPnt(-1, +1, +1);   // left  - bottom - back

	    // Planes
	    var plane = null;

	    // Front
	    plane = new Cupla3D.Plane(fillStyle, lineStyle, lineWidth);
	    plane.addPnt(p0);
	    plane.addPnt(p1);
	    plane.addPnt(p2);
	    plane.addPnt(p3);
	    this.addPlane(plane);

	    // Back
	    plane = new Cupla3D.Plane(fillStyle, lineStyle, lineWidth);
	    plane.addPnt(p4);
	    plane.addPnt(p7);
	    plane.addPnt(p6);
	    plane.addPnt(p5);
	    this.addPlane(plane);

	    // Bottom
	    plane = new Cupla3D.Plane(fillStyle, lineStyle, lineWidth);
	    plane.addPnt(p3);
	    plane.addPnt(p2);
	    plane.addPnt(p6);
	    plane.addPnt(p7);
	    this.addPlane(plane);

	    // Top
	    plane = new Cupla3D.Plane(fillStyle, lineStyle, lineWidth);
	    plane.addPnt(p0);
	    plane.addPnt(p4);
	    plane.addPnt(p5);
	    plane.addPnt(p1);
	    this.addPlane(plane);

	    // Left
	    plane = new Cupla3D.Plane(fillStyle, lineStyle, lineWidth);
	    plane.addPnt(p0);
	    plane.addPnt(p3);
	    plane.addPnt(p7);
	    plane.addPnt(p4);
	    this.addPlane(plane);

	    // Right
	    plane = new Cupla3D.Plane(fillStyle, lineStyle, lineWidth);
	    plane.addPnt(p1);
	    plane.addPnt(p5);
	    plane.addPnt(p6);
	    plane.addPnt(p2);
	    this.addPlane(plane);

	    // Final object size
	    this.scale(size);
	},

	rad2degvalue: 360 / (2 * Math.PI),
	deg2radvalue: 2 * Math.PI / 360,
	rad2deg: function(rad) { return rad * Cupla3D.rad2degvalue; },
	deg2rad: function(deg) { return deg * Cupla3D.deg2radvalue; },

	/** class Vector */
	Vector: function(a1, a2, a3, a4) {

		if (a1 instanceof Cupla3D.Vector) {
			// Vector(rhs)
		    this.x1 = a1.x1;
		    this.y1 = a1.y1;
		    this.x2 = a1.x2;
		    this.y2 = a1.y2;
		} else if (a1 instanceof Cupla3D.Pnt) {
			// Vector(p1,p2)
		    this.x1 = a1.x;
		    this.y1 = a1.y;
		    this.x2 = a2.x;
		    this.y2 = a2.y;
		} else {
			// Vector(x1,y1,x2,y2)
		    this.x1 = a1;
		    this.y1 = a2;
		    this.x2 = a3;
		    this.y2 = a4;
		}

	    this.dx = function() { return this.x2 - this.x1; };
	    this.dy = function() { return this.y1 - this.y2; };

	    this.angle = function() {
	        var a = Math.atan2(this.dy(), this.dx());
	        if (a < 0) {
	            a += 2 * Math.PI;
	        }
	        return a;
	    };

	    this.length = function() {
	        return Math.sqrt(Math.pow(this.dx(), 2) + Math.pow(this.dy(), 2));
	    };

	    this.setAngle = function(ang) {
	        var len = this.length();
	        this.x2 = this.x1 + len * Math.cos(ang);
	        this.y2 = this.y1 - len * Math.sin(ang);
	    };

	    this.rotate = function(ang) {
	        var a = this.angle();
	        a += ang;
	        var len = this.length();
	        this.x2 = this.x1 + len * Math.cos(a);
	        this.y2 = this.y1 - len * Math.sin(a);
	    };

	    this.setLength = function(len) {
	        // Set new length by adjusting end
	        var a = this.angle();
	        this.x2 = this.x1 + len * Math.cos(a);
	        this.y2 = this.y1 - len * Math.sin(a);
	    };

	    this.distance = function(pnt) {
	        // Get distance of pnt from vector as vector from this vector to pnt (angle is 90 degress from this vector),
	        // returns null if not next to this vector
	        var v = new Vector(this.x1, this.y1, pnt.x, pnt.y);  // vector from my beg to point
	        var angle = this.angle() - v.angle();                // angle between this and previous
	        if (angle < 0)
	            angle += 2 * Math.PI;
	        var len = v.length() * Math.cos(angle);              // "left" length of triangle, which travels along this
	        if (len < 0 || len > this.length())                  // if not inside me, then the point is not next to us
	            return null;
	        var dist = new Vector(this);                         // copy this vector
	        dist.setlength(len);                                 // shorten to the length
	        return new Vector(dist.x2, dist.y2, pnt.x, pnt.y);   // return vector from that point to the point
	    };
	}
};
