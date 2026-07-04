var scad_params = [
    {
        "name": "Default",
        "params": [
            {
                "name": "General",
                "children": [
                    {
                        "key": "quality",
                        "title": "Quality of tessellation",
                        "value": "50",
                        "range": [
                            "10",
                            "500"
                        ]
                    },
                    {
                        "key": "wheel_pin_hole_dia",
                        "title": "Wheel pin hole diameter (mm)",
                        "value": "4.2"
                    },
                    {
                        "key": "air_hole_dia",
                        "title": "Air hole diameter (mm)",
                        "value": "2.0"
                    },
                    {
                        "key": "air_hole_shroud_offset",
                        "title": "Air hole shroud offset",
                        "value": "0.5"
                    }
                ]
            },
            {
                "name": "Shroud",
                "children": [
                    {
                        "key": "shroud_dia",
                        "title": "Shroud diameter (mm)",
                        "value": "48.0"
                    },
                    {
                        "key": "shroud_thickness",
                        "title": "Shroud thickness (mm)",
                        "value": "1.5"
                    },
                    {
                        "key": "shroud_width",
                        "title": "Shroud width (mm)",
                        "value": "26.0"
                    }
                ]
            },
            {
                "name": "Tire channels",
                "children": [
                    {
                        "key": "chan_width",
                        "title": "Channel width (mm)",
                        "value": "4.2"
                    },
                    {
                        "key": "chan_thickness",
                        "title": "Channel thickness (mm)",
                        "value": "1.7"
                    },
                    {
                        "key": "chan_outer_height",
                        "title": "Outer channel height (mm)",
                        "value": "2.0"
                    },
                    {
                        "key": "chan_inner_height",
                        "title": "Inner channel height (mm)",
                        "value": "2.0"
                    }
                ]
            },
            {
                "name": "Hub",
                "children": [
                    {
                        "key": "hex_size",
                        "title": "Hex size, across flats (mm)",
                        "value": "12.3"
                    },
                    {
                        "key": "hex_depth",
                        "title": "Hex inset depth (mm)",
                        "value": "5.0"
                    },
                    {
                        "key": "hub_dia",
                        "title": "Hub cylinder diameter (mm)",
                        "value": "18.0"
                    },
                    {
                        "key": "hub_pininset_dia",
                        "title": "Hub pin inset diameter (mm)",
                        "value": "14.0"
                    },
                    {
                        "key": "hub_pin_depth",
                        "title": "Hub pin depth (mm)",
                        "value": "3.0"
                    },
                    {
                        "key": "hub_cyl_depth",
                        "title": "Hub cylinder depth (mm)",
                        "value": "10.0"
                    },
                    {
                        "key": "hub_face_offset",
                        "title": "Hub offset from inner face (mm)",
                        "value": "11.0"
                    }
                ]
            },
            {
                "name": "Spokes",
                "children": [
                    {
                        "key": "spoke_count",
                        "title": "Spoke count",
                        "value": "5",
                        "range": [
                            "1",
                            "20"
                        ]
                    },
                    {
                        "key": "spoke_duty",
                        "title": "Spoke duty (solid spoke fraction)",
                        "value": "0.4"
                    },
                    {
                        "key": "spoke_shroud_offset",
                        "title": "Shroud root offset (mm)",
                        "value": "2.0"
                    },
                    {
                        "key": "spoke_shroud_width",
                        "title": "Shroud root width (mm)",
                        "value": "8.0"
                    },
                    {
                        "key": "spoke_twist_shroud",
                        "title": "Shroud spoke twist (degrees)",
                        "value": "0.0"
                    },
                    {
                        "key": "spoke_hub_width",
                        "title": "Hub root width (mm)",
                        "value": "8.0"
                    },
                    {
                        "key": "spoke_hub_offset",
                        "title": "Hub root offset (mm)",
                        "value": "0.0"
                    },
                    {
                        "key": "spoke_twist_hub",
                        "title": "Hub spoke twist (degrees)",
                        "value": "0.0"
                    },
                    {
                        "key": "spoke_smooth_radius",
                        "title": "Spoke smoothing radius (mm)",
                        "value": "1.0"
                    },
                    {
                        "key": "spoke_steps",
                        "title": "# of subdivisions in a spoke",
                        "value": "2",
                        "range": [
                            "1",
                            "20"
                        ]
                    }
                ]
            },
            {
                "name": "Advanced",
                "children": [
                    {
                        "key": "eps",
                        "title": "Epsilon adjustment for printer (mm)",
                        "value": "0.1"
                    }
                ]
            }
        ]
    }
];