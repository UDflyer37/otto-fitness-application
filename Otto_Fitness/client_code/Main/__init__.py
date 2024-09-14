from ._anvil_designer import MainTemplate
from anvil import *
import anvil.server
import anvil.tables as tables
import anvil.tables.query as q
from anvil.tables import app_tables
from .ItemTemplateWorkout import ItemTemplateWorkout
import anvil.media
import random
from ..Max_Calculator import Max_Calculator
from ..Feedback import Feedback
from ..AI_Workout import AI_Workout

class Main(MainTemplate):
  def __init__(self, **properties):
    # Set Form properties and Data Bindings.
    self.init_components(**properties)
    self.workout_template = ItemTemplateWorkout()
    global platesAvailable  
    global standard 
    global time_elapsed
    time_elapsed = 0
    
    app_tables.workouts.client_readable()
    self.set_dropdown()
  
    standard = [
    ("45 lbs",45),
    ("35 lbs",35),
    ("25 lbs",25),
    ("10 lbs",10),
    ("5 lbs", 5),
    ("2.5 lbs", 2.5)] 
  
    self.set_standard()
    self.set_platesAvailable()
    self.set_weight_card()

  
  def set_dropdown(self, **event_args):
    if self.bench_chip.close_icon or self.squat_chip.close_icon or self.deadlift_chip.close_icon or self.squatober_chip.close_icon or self.freeweights_chip.close_icon:
      result = app_tables.workouts.search(tables.order_by('index', ascending=True))
      
      results = [(r['workout'],r) for r in result]
      if self.bench_chip.close_icon:
        result_bench = [(r['workout'],r) for r in result if r['bench']]
        results = list(set(result_bench) & set(results))
      if self.squat_chip.close_icon:
        result_squat = [(r['workout'],r) for r in result if r['squat']]
        results = list(set(result_squat) & set(results))
      if self.deadlift_chip.close_icon:
        result_deadlift = [(r['workout'],r) for r in result if r['deadlift']]
        results = list(set(result_deadlift) & set(results))
      if self.squatober_chip.close_icon:
        result_squatober = [(r['workout'],r) for r in result if r['squatober']]
        results = list(set(result_squatober) & set(results))
      if self.freeweights_chip.close_icon:
        result_freeweights = [(r['workout'],r) for r in result if r['freeweights_only']]
        results = list(set(result_freeweights) & set(results))
      
      self.workout_drop_down.items = results

    else: 
      self.workout_drop_down.items = [(r['workout'],r) for r in app_tables.workouts.search(tables.order_by('index', ascending=True))]

       


      
    
    
  #Set Max weight for plate calc function
  def set_max(self, **event_args):
    if self.working_max_switch.checked:
      max = int(int(self.max_weight_input.text)*0.9)
    else: 
      max = int(self.max_weight_input.text)
    return max


    
  #Set up Weight Calc card
  def set_weight_card(self, **event_args):
    self.text_box_45.text = standard[0][0]
    self.text_box_35.text = standard[1][0]
    self.text_box_25.text = standard[2][0]
    self.text_box_10.text = standard[3][0]
    self.text_box_5.text = standard[4][0]
    self.text_box_2_5.text = standard[5][0]


    
  #Weight calc funtion
  def calc_weight(self, **event_args):
    if self.text_box_1.text != None:
      x1 = int(self.text_box_1.text)*2
    else:
      x1 = 0
    if self.text_box_2.text != None:
      x2 = int(self.text_box_2.text)*2
    else:
      x2 = 0
    if self.text_box_3.text != None:
      x3 = int(self.text_box_3.text)*2
    else:
      x3 = 0
    if self.text_box_4.text != None:
      x4 = int(self.text_box_4.text)*2
    else:
      x4 = 0
    if self.text_box_6.text != None:
      x5 = int(self.text_box_6.text)*2
    else:
      x5 = 0
    if self.text_box_7.text != None:
      x6 = int(self.text_box_7.text)*2
    else:
      x6 = 0
    
    self.weight_calc_output.text=int(int(self.barWeight_text_box.text)+x1*standard[0][1]+x2*standard[1][1]+x3*standard[2][1]+x4*standard[3][1]+x5*standard[4][1]+x6*standard[5][1])


    
  #Initial set-up for plates available
  def set_standard(self, **event_args):
      self.check_box_45.text = standard[0][0]
      self.check_box_35.text = standard[1][0]
      self.check_box_25.text = standard[2][0]
      self.check_box_10.text = standard[3][0]
      self.check_box_5.text = standard[4][0]
      self.check_box_2_5.text = standard[5][0]
      
      self.check_box_45.checked = True
      self.check_box_35.checked = True
      self.check_box_25.checked = True
      self.check_box_10.checked = True
      self.check_box_5.checked = True
      self.check_box_2_5.checked = False


    
  #Set plates available
  def set_platesAvailable(self, **event_args):      
      global platesAvailable
      platesAvailable = []
      if self.check_box_45.checked :
        platesAvailable.append(standard[0][1])
      if self.check_box_35.checked :
        platesAvailable.append(standard[1][1])
      if self.check_box_25.checked :
        platesAvailable.append(standard[2][1])
      if self.check_box_10.checked :
        platesAvailable.append(standard[3][1])
      if self.check_box_5.checked :
        platesAvailable.append(standard[4][1])
      if self.check_box_2_5.checked :
        platesAvailable.append(standard[5][1])
      self.drop_down_available_weights.placeholder = str(platesAvailable)[1:-1]
      return platesAvailable
        
      

  #Set variables and run plate calc function
  def calculate_button_click(self, **event_args):
      #This method is called when the button is clicked
      if self.max_weight_input.text == None or self.percent_input.text == None or self.barWeight_text_box.text == None:
        pass
      else:
        platesAvailable = self.set_platesAvailable()
        barWeight = self.barWeight_text_box.text
        max = self.set_max()
        percent = int(self.percent_input.text)
    
#        self.output_card.visible = True
#        self.output.text = self.find_plates(max, percent, barWeight, platesAvailable)
        self.disclaimer.visible = True
        self.disclaimer.text = f"Working max is defined as 90% of ORM. Plates are for each side."

        output = Label(align='center', text=self.find_plates(max, percent, barWeight, platesAvailable))
        alert(content=output, title="Plates Required", large=True, buttons=[("Close", None)])

    

  #Plate Calc Function
  def find_plates(self, max, percent, barWeight, platesAvailable, **event_args):
      weight = int(max * (percent/100))
  
      plates = []
      nweights = []
      string = []
      remaining = weight - barWeight
  
      for  i, plate in enumerate(platesAvailable):
          if int(remaining / plate) % 2 == 0:
              nweights.append(int(remaining/ plate))
          else:
              nweights.append(int(remaining/ plate) - 1)
          remaining = remaining - nweights[i]*platesAvailable[i]
          if remaining == 0:
              break
  
      plates=zip(nweights, platesAvailable)
      string.append(f'Plates required to reach {int(weight-remaining)}lbs: \n')
  
      for plate in plates:
          if plate[0] >= 2:
              string.append(f"{int(plate[0]/2)} | {plate[1]} lb plate(s)")
  
      if remaining !=0:
          string.append(f'\n{"_" * 30}\n\nTarget weight: {weight} lbs. \n(The correct weight combination could not be found, the remaining weight is: {remaining}lbs)')
  
      return '\n'.join(string)

  #Flow Aesthetics
  def percent_input_pressed_enter(self, **event_args):
      """This method is called when the user presses Enter in this text box"""
      self.calculate_button_click()


    
#actively update list plates available list when changed
  def check_box_45_change(self, **event_args):
    """This method is called when this checkbox is checked or unchecked"""
    self.set_platesAvailable()

  def check_box_35_change(self, **event_args):
    """This method is called when this checkbox is checked or unchecked"""
    self.set_platesAvailable()

  def check_box_25_change(self, **event_args):
    """This method is called when this checkbox is checked or unchecked"""
    self.set_platesAvailable()

  def check_box_10_change(self, **event_args):
    """This method is called when this checkbox is checked or unchecked"""
    self.set_platesAvailable()

  def check_box_5_change(self, **event_args):
    """This method is called when this checkbox is checked or unchecked"""
    self.set_platesAvailable()

  def check_box_2_5_change(self, **event_args):
    """This method is called when this checkbox is checked or unchecked"""
    self.set_platesAvailable()



 #Tab Click Function 
  def tabs_1_tab_click(self, tab_index, tab_title, **event_args):
    """This method is called when a tab is clicked"""
    if self.tabs_1.active_tab_index == 0:
      self.basic_plate_math_card.visible=True
      self.weight_calc_card.visible = False
      self.planned_workout_card.visible=False
      self.workout_drop_down.visible = False
      self.timer_card.visible = False
      self.label_5.visible = False
      self.chip_panel.visible = False
    elif self.tabs_1.active_tab_index == 1:
      self.weight_calc_card.visible = True
      self.basic_plate_math_card.visible=False
      self.planned_workout_card.visible=False
      self.workout_drop_down.visible = False
      self.timer_card.visible = False
      self.label_5.visible = False
      self.chip_panel.visible = False
    elif self.tabs_1.active_tab_index == 2:
      self.planned_workout_card.visible=True
      self.basic_plate_math_card.visible=False
      self.weight_calc_card.visible = False
      self.workout_drop_down.visible = True
#      self.timer_card.visible = True
      self.label_5.visible = True
      self.chip_panel.visible = True


  #Dynamically change weight calc function
  def text_box_1_change(self, **event_args):
    """This method is called when the text in this text box is edited"""
    self.calc_weight()

  def text_box_2_change(self, **event_args):
    """This method is called when the text in this text box is edited"""
    self.calc_weight()

  def text_box_3_change(self, **event_args):
    """This method is called when the text in this text box is edited"""
    self.calc_weight()

  def text_box_4_change(self, **event_args):
    """This method is called when the text in this text box is edited"""
    self.calc_weight()

  def text_box_6_change(self, **event_args):
    """This method is called when the text in this text box is edited"""
    self.calc_weight()

  def text_box_7_change(self, **event_args):
    """This method is called when the text in this text box is edited"""
    self.calc_weight()


    
  #Flow Aesthetics
  def max_weight_input_pressed_enter(self, **event_args):
    """This method is called when the user presses Enter in this text box"""
    self.calculate_button_click()



  #Change workout
  def workout_drop_down_change(self, **event_args):
    """This method is called when an item is selected"""
    if self.workout_drop_down.selected_value == None:
      self.repeating_panel_1.visible=False
    else:
      self.repeating_panel_1.visible=True
      self.label_5.text = self.workout_drop_down.selected_value['workout']

  def calculate_workout_button_click(self, **event_args):
    """This method is called when the button is clicked"""
    if self.workout_drop_down.selected_value == None or self.max_squat.text == None or self.max_bench.text == None or self.max_deadlift.text == None:
      pass
    else:
      self.timer_card.visible = True
      self.repeating_panel_1.visible = True
      self.disclaimer_workout.visible = True
      self.spacer_5.scroll_into_view(smooth=True)
      app_tables.workout_details.client_readable()
      self.repeating_panel_1.items = app_tables.workout_details.search(tables.order_by('order',ascending=True),title=self.workout_drop_down.selected_value["workout"])
      self.repeating_panel_1.raise_event_on_children('x-refresh', max_bench = self.max_bench.text, max_squat = self.max_squat.text,
                                                    max_deadlift = self.max_deadlift.text, plates_available = self.set_platesAvailable(), 
                                                    bar_weight = self.barWeight_text_box.text)

  def random_workout_link_click(self, **event_args):
    """This method is called when the link is clicked"""
    if self.max_squat.text == None or self.max_bench.text == None or self.max_deadlift.text == None:
          pass
    else:
      self.timer_card.visible = True
      self.repeating_panel_1.visible = True
      self.disclaimer_workout.visible = True
      self.spacer_5.scroll_into_view(smooth=True)
      x = random.choice(range(0,len(self.workout_drop_down.items)))
      self.workout_drop_down.selected_value = None
      self.label_5.visible = True
      self.label_5.text =  self.workout_drop_down.items[x][0]
      app_tables.workout_details.client_readable()
      self.repeating_panel_1.items = app_tables.workout_details.search(tables.order_by('order',ascending=True),title=self.workout_drop_down.items[x][0])
      self.repeating_panel_1.raise_event_on_children('x-refresh', max_bench = self.max_bench.text, max_squat = self.max_squat.text,
                                                    max_deadlift = self.max_deadlift.text, plates_available = self.set_platesAvailable(), 
                                                    bar_weight = self.barWeight_text_box.text)
    

  #Timer functions
  def time_convert(self, sec, **properties):
    mins = sec // 60
    sec = sec % 60
    hours = mins // 60
    mins = mins % 60
    return "{0:02d} : {1:02d}".format(int(mins),int(sec))
  
  def timer_button_click(self, **event_args):
    """This method is called when the button is clicked"""
    global start_time
    if self.timer_button.text == "Start":
      self.timer_button.text = "Stop"
      self.timer_button.background = "#fdb9b9"
    elif self.timer_button.text == "Stop":
      self.timer_button.text = "Start"
      self.timer_button.background = "#a6f2bd"
      
  def output_time(self, **event_args):
    global time_elapsed
    time_elapsed = time_elapsed + 1
    self.timer.text = self.time_convert(time_elapsed)
    return time_elapsed

  def timer_reset_button_click(self, **event_args):
    """This method is called when the button is clicked"""
    global time_elapsed
    time_elapsed = 0
    self.timer.text = "00 : 00"

  def timer_1_tick(self, **event_args):
    """This method is called Every [interval] seconds. Does not trigger if [interval] is 0."""
    if self.timer_button.text == "Stop":
      self.output_time()

  def max_calc_link_click(self, **event_args):
    """This method is called when the link is clicked"""
    alert(Max_Calculator(item=self.item), large=True, buttons=[("Close", None)], title="One-Rep Max (1RM) Esitmate Calculator")

  def feedback_button_click(self, **event_args):
    """This method is called when the button is clicked"""
    alert(Feedback(item=self.item), large=True, buttons=[("Close", None)])




  def deadlift_chip_click(self, **event_args):
    """This method is called when the chip is clicked"""
    if self.deadlift_chip.close_icon == False:
      self.deadlift_chip.background = "theme:Tertiary Container"
      self.deadlift_chip.close_icon = True    
      self.set_dropdown()
    else:
      self.deadlift_chip.background = ""
      self.deadlift_chip.close_icon = False
      self.set_dropdown()

  def squat_chip_click(self, **event_args):
    """This method is called when the chip is clicked"""
    if self.squat_chip.close_icon == False:
      self.squat_chip.background = "theme:Tertiary Container"
      self.squat_chip.close_icon = True    
      self.set_dropdown()
    else:
      self.squat_chip.background = ""
      self.squat_chip.close_icon = False
      self.set_dropdown()

  def bench_chip_click(self, **event_args):
    """This method is called when the chip is clicked"""
    if self.bench_chip.close_icon == False:
      self.bench_chip.background = "theme:Tertiary Container"
      self.bench_chip.close_icon = True    
      self.set_dropdown()
    else:
      self.bench_chip.background = ""
      self.bench_chip.close_icon = False
      self.set_dropdown()

  def squatober_chip_click(self, **event_args):
    """This method is called when the chip is clicked"""
    if self.squatober_chip.close_icon == False:
      self.squatober_chip.background = "theme:Tertiary Container"
      self.squatober_chip.close_icon = True    
      self.set_dropdown()
    else:
      self.squatober_chip.background = ""
      self.squatober_chip.close_icon = False
      self.set_dropdown()

  def freeweights_chip_click(self, **event_args):
    """This method is called when the close link is clicked"""
    if self.freeweights_chip.close_icon == False:
      self.freeweights_chip.background = "theme:Tertiary Container"
      self.freeweights_chip.close_icon = True    
      self.set_dropdown()
    else:
      self.freeweights_chip.background = ""
      self.freeweights_chip.close_icon = False
      self.set_dropdown()

  def AI_workout_link_click(self, **event_args):
    """This method is called when the link is clicked"""
    alert(AI_Workout(item=self.item), large=True, buttons=[("Close", None)])












