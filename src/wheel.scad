// Parametric RC wheel
//
// Copyright 2026 Randall Frank
//
// Version history:
//     22 May 2026 1.10  - Improved spokes - smooth and twist options
//     17 May 2026 1.00  - Initial release
//
// Permission is hereby granted, free of charge, to any person 
// obtaining a copy of this software and associated documentation 
// files (the "Software"), to deal in the Software without restriction, 
// including without limitation the rights to use, copy, modify, 
// merge, publish, distribute, sublicense, and/or sell copies of 
// the Software, and to permit persons to whom the Software is 
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall 
// be included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY 
// KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE 
// WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE 
// AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT 
// HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, 
// WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING 
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR 
// OTHER DEALINGS IN THE SOFTWARE.
//

/* [General] */
// Quality of tessellation
quality = 50; // [10:500]
// Wheel pin hole diameter (mm)
wheel_pin_hole_dia = 4.2;
// Air hole diameter (mm)
air_hole_dia = 2.0;
// Air hole shroud offset
air_hole_shroud_offset = 0.5;

/* [Shroud] */
// Shroud diameter (mm)
shroud_dia = 48.0; 
// Shroud thickness (mm)
shroud_thickness = 1.5;
// Shroud width (mm)
shroud_width = 26.0;

/* [Tire channels] */
// Channel width (mm)
chan_width = 4.2;
// Channel thickness (mm)
chan_thickness = 1.7;
// Outer channel height (mm)
chan_outer_height = 2.0;
// Inner channel height (mm)
chan_inner_height = 2.0;

/* [Hub] */
// Hex size, across flats (mm)
hex_size = 12.3;
// Hex inset depth (mm)
hex_depth = 5.0; 
// Hub cylinder diameter (mm)
hub_dia = 18.0;
// Hub pin inset diameter (mm)
hub_pininset_dia = 14.0;
// Hub pin depth (mm)
hub_pin_depth = 3.0;
// Hub cylinder depth (mm)
hub_cyl_depth = 10.0;
// Hub offset from inner face (mm)
hub_face_offset = 11.0;

/* [Spokes] */
// Spoke count
spoke_count = 5; // [1:20]
// Spoke duty (solid spoke fraction)
spoke_duty = 0.4;
// Shroud root offset (mm)
spoke_shroud_offset = 2.0;
// Shroud root width (mm)
spoke_shroud_width = 8.0;
// Shroud spoke twist (degrees)
spoke_twist_shroud = 0.0;
// Hub root width (mm)
spoke_hub_width = 8.0;
// Hub root offset (mm)
spoke_hub_offset = 0.0;
// Hub spoke twist (degrees)
spoke_twist_hub = 0.0;
// Spoke smoothing radius (mm)
spoke_smooth_radius = 1.0;
// # of subdivisions in a spoke
spoke_steps = 2;  // [1:20]

/* [Advanced] */
// Epsilon adjustment for printer (mm)
eps = 0.1;

/* [Hidden] */
$fn = quality;
eps2 = 0.25;  // Used when clipping to avoid coincident planes


// Utility functions
function lerp(start, end, t) = start + (end - start) * t;

function cyl2cart(r, a, z) = [r*sin(a), r*cos(a), z];

function avgpoint(a, b, c, d) = [
                                    (a[0]+b[0]+c[0]+d[0])*0.25,
                                    (a[1]+b[1]+c[1]+d[1])*0.25,
                                    (a[2]+b[2]+c[2]+d[2])*0.25
                                ];

function normalize(v) = v / norm(v);

module hexagon(size, depth) {
    // size is the "short diagonal" (distance between nodes with a skip)
    // a is the length of flat edge (distance between nodes no skips)
    // D is the "long diagonal" (distance between nodes with two skips)
    // D = 2*a and size = a * sqrt(3.)
    a = size / sqrt(3);
    d = 2 * a;
    cylinder(r=d*0.5, h=depth, $fn=6);
}


// ^ X/Y
// |
// | ----0-B--1-A---z- outer wheel (od) radius
// |    /    /
// |   /    /
// | -2-C-3-D-------z-   inner hex cylinder radius 
// |
// +---------------->  Z
//
// z = shroud_width
// 1 = shroud_width - spoke_shroud_offset
// 0 = 1 - spoke_shroud_width
// 2 = 3 - spoke_hub_width
// 3 = hub_face_offset + hub_cyl_depth + spoke_hub_offset
//

// Make a "blade" from hub radius (r0) to shroud radius (r1)
//
// The blade is centered at 'angle' and has the width 'delta_angle'.
// At r0, the blade should be rotated twists[0].  At r1, the blade
// should be rotated twists[1].  The twist is about a line that
// runs from the center of the r0 quad through the center of the r1
// quad.
// The algorithm is to compute the quads at r1 and r2.  Next, compute
// the line equations from corresponding points in each quad.
// Now, step the lines parametrically, and generate a quad of four spheres
// at the points.  Finally, walk each pair of quads and use hull() to
// generate a smoothed segment of the blade.

module point_elem(rad, h) {
    // cylinder(r=rad, h=dh);
    sphere(r=rad);
}

module blade(r0, r1, angle, delta_angle, offsets, widths,
             steps, sphere_radius, twists) {
    
    // Note: the sphere/hull will inflate the blade by the sphere
    // radius, so we adjust the points a little here to correct
    // for it.
    
    // four points on hub
    h0 = cyl2cart(r0, angle+delta_angle, offsets[0]+sphere_radius);
    h1 = cyl2cart(r0, angle+delta_angle, offsets[0]+widths[0]-sphere_radius);
    h2 = cyl2cart(r0, angle-delta_angle, offsets[0]+sphere_radius);
    h3 = cyl2cart(r0, angle-delta_angle, offsets[0]+widths[0]-sphere_radius);
    
    c0 = avgpoint(h0, h1, h2, h3);
    
    // four points on shroud
    s0 = cyl2cart(r1, angle+delta_angle, offsets[1]+sphere_radius);
    s1 = cyl2cart(r1, angle+delta_angle, offsets[1]+widths[1]-sphere_radius);
    s2 = cyl2cart(r1, angle-delta_angle, offsets[1]+sphere_radius);
    s3 = cyl2cart(r1, angle-delta_angle, offsets[1]+widths[1]-sphere_radius);

    c1 = avgpoint(s0, s1, s2, s3);
    
    twist_vector = normalize(c1-c0);
    twist_point = c0;
    
    t = 0.0;
    t_delta = 1.0 / steps;
    
    twist = twists[0];
    twist_delta = (twists[1] - twists[0]) / steps;
    
    dh = 0.01;
    
    union() {
        // Generate the blade with a 1 step over/under shoot
        // This is then clipped against the hub and shround 
        // cylinders.
        for(step=[0: 1: steps]) {
            t0 = 0 + (step*t_delta);
            t1 = t0 + t_delta;
            twist0 = twists[0] + (step*twist_delta);
            twist1 = twist0 + twist_delta;
            
            // Hull a "slab" of the blade using 8 points
            hull() {
                // Rectangle of points at R defined by t0
                p0 = lerp(h0, s0, t0);
                p1 = lerp(h1, s1, t0);
                p2 = lerp(h2, s2, t0);
                p3 = lerp(h3, s3, t0);
            
                translate(twist_point) {
                    rotate(a=twist0, v=twist_vector) {
                        translate(-twist_point) {
                            translate(p0) point_elem(sphere_radius, dh);
                            translate(p1) point_elem(sphere_radius, dh);
                            translate(p2) point_elem(sphere_radius, dh);
                            translate(p3) point_elem(sphere_radius, dh);
                        }
                    }
                }

                // Rectangle of points at R defined by t1
                p4 = lerp(h0, s0, t1);
                p5 = lerp(h1, s1, t1);
                p6 = lerp(h2, s2, t1);
                p7 = lerp(h3, s3, t1);
                
                translate(twist_point) {
                    rotate(a=twist1, v=twist_vector) {
                        translate(-twist_point) {
                            translate(p4) point_elem(sphere_radius, dh);
                            translate(p5) point_elem(sphere_radius, dh);
                            translate(p6) point_elem(sphere_radius, dh);
                            translate(p7) point_elem(sphere_radius, dh);
                        }
                    }
                }
            }
        }
    }
}


module spokes() {
    // Think like one is revolving a shape on 
    // the x,y plane around the y axis.
    x0 = hub_dia*0.5 - eps;
    x1 = shroud_dia*0.5 - shroud_thickness + eps;
    
    p0 = [x1, shroud_width - spoke_shroud_offset - spoke_shroud_width];
    p1 = [x1, shroud_width - spoke_shroud_offset];
    p2 = [x0, hub_face_offset + hub_cyl_depth + spoke_hub_offset - spoke_hub_width];
    p3 = [x0, hub_face_offset + hub_cyl_depth + spoke_hub_offset];
    
    // revolve the polygon around the Z axis
    // count = number of spokes, gap = degrees to narrow the spoke by
    if (spoke_count > 1) {
        delta_angle = 360. / spoke_count;
        spoke_width = delta_angle * spoke_duty;
        
        r0 = hub_dia*0.5 - eps;
        r1 = shroud_dia*0.5 - shroud_thickness + eps;
        offsets = [ 
          hub_face_offset + hub_cyl_depth + spoke_hub_offset - spoke_hub_width, 
          shroud_width - spoke_shroud_offset - spoke_shroud_width];
        widths = [spoke_hub_width, spoke_shroud_width];        
        twists = [spoke_twist_hub, spoke_twist_shroud];
          
        difference() {
            intersection() {
                translate([0,0,-shroud_width/2]) {
                    cylinder(h=shroud_width*2,r=r1,$fn=500);
                }
                union() {
                    // Generate spoke_count spokes centered every delta_angle 
                    // degrees, each spoke_width wide
                    for(i=[0 : spoke_count-1]) {
                        angle = i * delta_angle + 5.5;
                        blade(r0, r1, angle, spoke_width*0.5, offsets, widths, 
                              spoke_steps, spoke_smooth_radius, twists);  
                    }
                }
            }
            translate([0,0,-shroud_width/2]) {
                cylinder(h=shroud_width*2,r=r0,$fn=500);
            }
        }
        
    } else {
        rotate_extrude(angle=360,start=0,convexity=2) {
            polygon(points=[p0,p2,p3,p1]);
        }
    }
}

module chan_ring() {
    union() {
        if (chan_outer_height > 0.0) {
            difference() {
                cylinder(h=chan_thickness, 
                         r=shroud_dia*0.5+chan_outer_height,$fn=500);
                translate([0,0,-eps2*0.5]) {
                    cylinder(h=chan_thickness+eps2, 
                         r=shroud_dia*0.5,$fn=500);
                }
            }
        }
        if (chan_inner_height > 0.0) {
            translate([0,0,chan_width+chan_thickness]) {
                difference() {
                    cylinder(h=chan_thickness, 
                             r=shroud_dia*0.5+chan_inner_height,$fn=500);
                    translate([0,0,-eps2*0.5]) {
                        cylinder(h=chan_thickness+eps2, 
                                 r=shroud_dia*0.5,$fn=500);
                    }
                }
            }
        }
    }
}

module chan_rings() {
    union() {
        chan_ring();
        translate([0,0,shroud_width]) {
            mirror([0,0,1]) {
                chan_ring();
            }
        }
    }
}

module wheel() {
    union() {
        difference() {
            union() {
                difference() {
                    cylinder(h=shroud_width, 
                             r=shroud_dia*0.5, $fn=500);
                    translate([0,0,-eps2*0.5]) {
                        cylinder(h=shroud_width+eps2, 
                                 r=shroud_dia*0.5-shroud_thickness, 
                                 $fn=500);
                    }
                }
                spokes();
            }
            // air holes
            if (air_hole_dia > 0.) {
                union() {
                    translate([-shroud_dia*0.5-shroud_thickness*0.5, 
                               0, shroud_width*air_hole_shroud_offset]) {
                        rotate([0, 90, 0]) {
                            cylinder(h=shroud_thickness*2, 
                                     r=air_hole_dia*0.5);
                        }
                    }
                    translate([shroud_dia*0.5-shroud_thickness*1.5, 
                               0, shroud_width*air_hole_shroud_offset]) {
                        rotate([0, 90, 0]) {
                            cylinder(h=shroud_thickness*2, 
                                     r=air_hole_dia*0.5);
                        }
                    }
                    translate([0, shroud_dia*0.5+shroud_thickness*0.5,
                               shroud_width*air_hole_shroud_offset]) {
                        rotate([90, 0, 0]) {
                            cylinder(h=shroud_thickness*2, 
                                     r=air_hole_dia*0.5);
                        }
                    }
                    translate([0, -shroud_dia*0.5+shroud_thickness*1.5,
                               shroud_width*air_hole_shroud_offset]) {
                        rotate([90, 0, 0]) {
                            cylinder(h=shroud_thickness*2, 
                                     r=air_hole_dia*0.5);
                        }
                    }
                }
            }
        }
        translate([0, 0, hub_face_offset]) {
            difference() {
                cylinder(r=hub_dia*0.5, h=hub_cyl_depth, $fn=500);
                union() {
                    cylinder(r=wheel_pin_hole_dia*0.5+eps, 
                             h=shroud_width, $fn=500);
                    translate([0,0,-eps*0.5]) {
                        hexagon(hex_size+eps, hex_depth);
                    }
                    // The pin only extends so far out.
                    // To insure the nut can be affixed,
                    // only hub_pin_depth overs the pin.
                    if (hub_pininset_dia > 0.) {
                        translate([0,0,hub_cyl_depth-hub_pin_depth]) {
                            cylinder(r=hub_pininset_dia*0.5, 
                                     h=hub_cyl_depth, $fn=500);
                        }
                    }
                }
            }
        }
        chan_rings();
    }
}


wheel();
