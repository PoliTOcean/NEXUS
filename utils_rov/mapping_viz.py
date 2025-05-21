import yaml
import svgwrite
import os

def load_config(yaml_file):
    with open(yaml_file, 'r') as file:
        config = yaml.safe_load(file)
    return config

def create_controller_map(config, output_file):
    # Create larger SVG drawing
    dwg = svgwrite.Drawing(output_file, profile='full', size=('1200px', '900px'))
    
    # Add styles with additional color for shift commands and free commands
    dwg.add(dwg.style("""
        .button { fill: white; stroke-width: 2; }
        .button-label { font-family: Arial; font-size: 12px; text-anchor: middle; }
        .command-label { font-family: Arial; font-size: 14px; }
        .topic-label { font-family: Arial; font-size: 10px; font-style: italic; }
        .shift-command { font-family: Arial; font-size: 14px; fill: #9b59b6; }
        .arm-command { stroke: #3498db; fill: #3498db; }
        .state-command { stroke: #e74c3c; fill: #e74c3c; }
        .axis-control { stroke: #2ecc71; fill: #2ecc71; }
        .free-command { stroke: #777; fill: #777; }
        .controller-outline { fill: #f1f1f1; stroke: #333; stroke-width: 3; }
        .title { font-family: Arial; font-size: 24px; text-anchor: middle; fill: #333; }
        .subtitle { font-family: Arial; font-size: 16px; text-anchor: middle; fill: #666; }
    """))
    
    # Draw controller body - with more realistic Xbox controller shape
    controller = dwg.add(dwg.g(id='controller'))
    controller.add(dwg.path(
        d="M350,250 C300,250 250,270 220,310 C180,360 170,420 170,450 C170,500 180,550 220,600 C260,650 320,670 350,680 "
          "C450,700 650,700 750,680 C780,670 840,650 880,600 C920,550 930,500 930,450 C930,420 920,360 880,310 C850,270 800,250 750,250 "
          "C650,240 450,240 350,250 Z",
        class_="controller-outline"
    ))
    
    # Add title
    dwg.add(dwg.text('Xbox Controller Button Mapping', insert=(600, 40), class_="title"))
    dwg.add(dwg.text('Generated from joystick_Move.yaml', insert=(600, 70), class_="subtitle"))
    
    # Define button positions - scaled up
    button_positions = {
        # Face buttons
        'A': (800, 480),
        'B': (850, 430),
        'X': (750, 430),
        'Y': (800, 380),
        
        # Shoulder buttons and triggers
        'LB': (300, 280),
        'RB': (800, 280),
        'LT': (300, 240),
        'RT': (800, 240),
        
        # Center buttons
        'View': (450, 400),
        'Option': (650, 400), 
        'Start': (550, 350),
        
        # Thumbsticks - right one moved lower
        'LC': (350, 450),
        'RC': (650, 550),  # Right stick lowered to 550
        'LSB-X': (350, 450),
        'LSB-Y': (350, 450),
        'RSB-X': (650, 550),  # Updated to match RC
        'RSB-Y': (650, 550),  # Updated to match RC
        
        # D-pad
        'D-Pad-Up': (450, 530),
        'D-Pad-Down': (450, 570),
        'D-Pad-Left': (430, 550),
        'D-Pad-Right': (470, 550),
        
        # Extra buttons - UPLOAD on line with Back/Opt
        'UPLOAD': (550, 400),
    }
    
    # Label offset configurations
    label_offsets = {
        # Face buttons
        'A': {'x': 50, 'y': 30},
        'B': {'x': 40, 'y': 20},
        'X': {'x': 120, 'y': -40},
        'Y': {'x': 80, 'y': -60},
        
        # Shoulder buttons
        'LB': {'x': 70, 'y': -10},
        'RB': {'x': -70, 'y': -10},
        'LT': {'x': -120, 'y': -30},
        'RT': {'x': 120, 'y': -30},
        
        # Center buttons
        'View': {'x': 0, 'y': -50},
        'Option': {'x': 10, 'y': -50},
        'Start': {'x': 0, 'y': -50},
        
        # Thumbsticks
        'LC': {'x': -60, 'y': -10},
        'RC': {'x': 10, 'y': 90},
        
        # D-pad
        'D-Pad-Up': {'x': -70, 'y': -10},
        'D-Pad-Down': {'x': -30, 'y': 60},
        'D-Pad-Left': {'x': -70, 'y': 30},
        'D-Pad-Right': {'x': 10, 'y': 60},
        
        # UPLOAD positioned below the button
        'UPLOAD': {'x': 1, 'y': 60}
    }
    
    # Axis label offset configuration
    axis_label_offsets = {
        'LSB-X': {'x': -40, 'y': -70},
        'RSB-X': {'x': 70, 'y': 20},
        'LT': {'x': -40, 'y': -20},
        'RT': {'x': 40, 'y': -20}
    }
    
    # Draw buttons and labels
    buttons = config.get('buttons', {})
    for button_name, button_config in buttons.items():
        if button_name in button_positions:
            x, y = button_positions[button_name]
            
            # Determine button style based on topic
            topic = button_config.get('topic', '')
            
            # Updated to include "axes/" in axis-control class
            button_class = "arm-command" if topic and "arm_commands" in topic else \
                          "state-command" if topic and "state_commands" in topic else \
                          "axis-control" if topic and "axes/" in topic else \
                          "free-command"
            
            # Create button group
            button_group = dwg.add(dwg.g(id=f'button-{button_name}'))
            
            # Draw button
            if button_name in ['A', 'B', 'X', 'Y']:
                button_group.add(dwg.circle(center=(x, y), r=20, class_="button" + (" " + button_class if button_class else "")))
                button_group.add(dwg.text(button_name, insert=(x, y+5), class_="button-label"))
            elif button_name in ['LB', 'RB', 'LT', 'RT']:
                button_group.add(dwg.rect((x-25, y-15), (50, 30), rx=5, ry=5, class_="button" + (" " + button_class if button_class else "")))
                button_group.add(dwg.text(button_name, insert=(x, y+5), class_="button-label"))
            elif 'D-Pad' not in button_name and button_name not in ['LSB-X', 'LSB-Y', 'RSB-X', 'RSB-Y']:
                button_group.add(dwg.rect((x-20, y-15), (40, 30), rx=5, ry=5, class_="button" + (" " + button_class if button_class else "")))
                short_name = button_name.replace('Option', 'Opt').replace('View', 'Back')
                button_group.add(dwg.text(short_name, insert=(x, y+5), class_="button-label"))
            
            # Get command info
            command = button_config.get('onPress', '')
            release_command = button_config.get('onRelease', '')
            shift_press = button_config.get('onShiftPress', '')
            shift_release = button_config.get('onShiftRelease', '')
            
            # If no command specified, use "FREE" as default
            if not command and button_name not in ['LSB-X', 'LSB-Y', 'RSB-X', 'RSB-Y']:
                command = "FREE"
            
            if button_name in ['LSB-X', 'LSB-Y', 'RSB-X', 'RSB-Y']:
                continue
                
            # Calculate label position using offsets
            if button_name in label_offsets:
                offset_x = label_offsets[button_name]['x']
                offset_y = label_offsets[button_name]['y']
            else:
                offset_x = 60 if x < 600 else -60
                offset_y = -30 if y > 450 else 60
            
            label_x, label_y = x + offset_x, y + offset_y
            
            # Draw connecting line - always with a class
            line_args = {
                'start': (x, y), 
                'end': (label_x, label_y), 
                'stroke_dasharray': "3,2",
                'class_': button_class
            }
            button_group.add(dwg.line(**line_args))
            
            # Create command label
            label_text = command
            if release_command and release_command != command:
                label_text += f" / {release_command}"
                
            # Add command label
            text_anchor = "start" if offset_x > 0 else "end"
            text_args = {
                'insert': (label_x, label_y), 
                'text_anchor': text_anchor,
                'class_': "command-label" + (" " + button_class if button_class else "")
            }
            button_group.add(dwg.text(label_text, **text_args))
            
            # Add shift commands if they exist and aren't "FREE"
            shift_text = ""
            if shift_press and shift_press != "FREE":
                shift_text = f"SHIFT: {shift_press}"
                if shift_release and shift_release != "FREE" and shift_release != shift_press:
                    shift_text += f" / {shift_release}"
            elif shift_release and shift_release != "FREE":
                shift_text = f"SHIFT: {shift_release}"
                
            if shift_text:
                shift_args = {
                    'insert': (label_x, label_y + 30), 
                    'text_anchor': text_anchor,
                    'class_': "shift-command"
                }
                button_group.add(dwg.text(shift_text, **shift_args))
            
            # Add topic label
            if topic:
                topic_args = {
                    'insert': (label_x, label_y + 15), 
                    'text_anchor': text_anchor,
                    'class_': "topic-label" + (" " + button_class if button_class else "")
                }
                button_group.add(dwg.text(topic, **topic_args))
            else:
                # Add "None" for topic if it's not present
                topic_args = {
                    'insert': (label_x, label_y + 15), 
                    'text_anchor': text_anchor,
                    'class_': "topic-label" + (" " + button_class if button_class else "")
                }
                button_group.add(dwg.text("None", **topic_args))
    
    # Draw thumbsticks
    thumbsticks = dwg.add(dwg.g(id='thumbsticks'))
    thumbsticks.add(dwg.circle(center=(350, 450), r=25, class_="button axis-control"))  # Left stick
    thumbsticks.add(dwg.circle(center=(650, 550), r=25, class_="button axis-control"))  # Right stick - updated position
    
    # Draw D-pad as a cross instead of a circle
    dpad = dwg.add(dwg.g(id='dpad'))
    dpad_center_x, dpad_center_y = 450, 550
    
    # Horizontal rectangle for D-pad
    dpad.add(dwg.rect(
        (dpad_center_x - 25, dpad_center_y - 10), 
        (50, 20), 
        class_="button state-command"
    ))
    
    # Vertical rectangle for D-pad
    dpad.add(dwg.rect(
        (dpad_center_x - 10, dpad_center_y - 25), 
        (20, 50), 
        class_="button state-command"
    ))
    
    # Draw axis controls
    axes = config.get('axes', {})
    for axis_name, axis_config in axes.items():
        if axis_name in button_positions:
            x, y = button_positions[axis_name]
            command = axis_config.get('command', '')
            deadzone = axis_config.get('deadzone', 0)
            
            # Only draw main axis labels to avoid clutter
            if axis_name in ['LSB-X', 'RSB-X', 'LT', 'RT']:
                axis_group = dwg.add(dwg.g(id=f'axis-{axis_name}'))
                
                # Position labels using the offset configuration
                if axis_name in axis_label_offsets:
                    label_x = x + axis_label_offsets[axis_name]['x']
                    label_y = y + axis_label_offsets[axis_name]['y']
                    anchor = "end" if axis_label_offsets[axis_name]['x'] < 0 else "start"
                else:
                    if 'LT' in axis_name or 'RT' in axis_name:
                        label_x = x - 50 if 'LT' in axis_name else x + 50
                        label_y = y
                        anchor = "end" if 'LT' in axis_name else "start"
                    else:
                        if 'LSB' in axis_name:
                            label_x, label_y = 250, 520
                            anchor = "start"
                        else:  # RSB
                            label_x, label_y = 800, 620  # Updated for new position
                            anchor = "end"
                
                # Draw line
                axis_group.add(dwg.line(start=(x, y), end=(label_x, label_y), 
                                      class_="axis-control", stroke_dasharray="3,2"))
                
                # Create label text
                if 'LSB-X' in axis_name:
                    x_cmd = axes.get('LSB-X', {}).get('command', '')
                    y_cmd = axes.get('LSB-Y', {}).get('command', '')
                    cmd_text = f"X: {x_cmd}, Y: {y_cmd}"
                    dz_text = f"Deadzone: {deadzone}"
                elif 'RSB-X' in axis_name:
                    x_cmd = axes.get('RSB-X', {}).get('command', '')
                    y_cmd = axes.get('RSB-Y', {}).get('command', '')
                    cmd_text = f"X: {x_cmd}, Y: {y_cmd}"
                    dz_text = f"Deadzone: {deadzone}"
                else:
                    cmd_text = f"{command}"
                    dz_text = f"Deadzone: {deadzone}"
                
                # Add labels
                axis_group.add(dwg.text(cmd_text, insert=(label_x, label_y), 
                                       class_="command-label axis-control", text_anchor=anchor))
                axis_group.add(dwg.text(dz_text, insert=(label_x, label_y + 15), 
                                       class_="topic-label axis-control", text_anchor=anchor))
    
    # Add legend in center
    legend = dwg.add(dwg.g(id='legend', transform='translate(550, 150)'))
    legend.add(dwg.rect((-110, -50), (220, 180), fill='white', stroke='#333', rx=5, ry=5))
    legend.add(dwg.text('Legend', insert=(0, -25), class_="subtitle", text_anchor="middle"))
    
    # Legend items
    y_pos = 0
    for label, css_class in [
        ('Arm Commands', 'arm-command'),
        ('State Commands', 'state-command'),
        ('Axis Controls', 'axis-control'),
        ('Free Buttons', 'free-command'),
        ('Shift Commands', 'shift-command')
    ]:
        legend.add(dwg.rect((-100, y_pos-10), (20, 20), class_="button" + (" " + css_class if css_class else "")))
        legend.add(dwg.text(label, insert=(-50, y_pos+5), class_="command-label" + (" " + css_class if css_class else ""), text_anchor="start"))
        y_pos += 25
    
    # Save SVG file
    dwg.save()
    print(f"Controller map saved as {output_file}")

def init_mapping_viz():
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_image = os.path.join(script_dir, "xbox_controller_map.svg")

    config_file = os.path.join(script_dir, "config", "joystick_Move.yaml")
    config = load_config(config_file)
    create_controller_map(config, output_image)