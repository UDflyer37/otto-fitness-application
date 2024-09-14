from ._anvil_designer import ItemTemplateWorkoutTemplate
from anvil import *
import anvil.server
import anvil.tables as tables
import anvil.tables.query as q
from anvil.tables import app_tables
from ...Workout_Popout import Workout_Popout

class ItemTemplateWorkout(ItemTemplateWorkoutTemplate):
  def __init__(self, **properties):
    # Set Form properties and Data Bindings.
    self.init_components(**properties)
    global maxBench
    global maxDeadlift
    global maxSquat
    global platesAvailable
    global barWeight
    global max
    global string

    self.item['completed'] = False
    
    self.set_event_handler('x-refresh', self.refresh)


  def refresh(self, max_bench, max_squat, max_deadlift, plates_available, bar_weight, **event_args):
    global maxBench
    global maxSquat
    global maxDeadlift
    global platesAvailable
    global barWeight
    global max
    maxBench = max_bench 
    maxSquat = max_squat
    maxDeadlift = max_deadlift
    platesAvailable = plates_available
    barWeight = bar_weight

    
    percent = self.item['percent'] 


    
    if percent == None:
      self.pre_output.text = "Challenge yourself... Focus on form over weight."
      pass
    else:
      if self.item['bench']:
        max = maxBench
      elif self.item['squat']:
        max = maxSquat
      elif self.item['deadlift']:
        max = maxDeadlift

      output, weight = self.find_plates(int(max), int(percent), int(barWeight), platesAvailable)
      self.pre_output.text = output[0]
      self.main_output.text = '\n'.join(output[1:])

      self.weight_label.text = str(weight) + " lbs | "

    if self.item['superset']:
      self.superset.visible = True
    if self.item['superset_2']:
      self.superset2.visible = True
    
      
    

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
          string.append(f'Plates required to reach {weight-remaining} lbs: ')
      
          for plate in plates:
                  if plate[0] >= 2:
                          string.append(f"{int(plate[0]/2)} | {plate[1]} lb plate(s)")
      
          return string, weight-remaining

  def workout_link_click(self, **event_args):
    """This method is called when the link is clicked"""
    result = alert(Workout_Popout(item=self.item), large=True, buttons=[("Completed", True), ("Close", False)])
    if result:
      self.item['completed'] = result
      self.outlined_card_1.background = "theme:Disabled Container"
      self.check_box.checked = self.item['completed']

  def details_button_click(self, **event_args):
    """This method is called when the button is clicked"""
    result = alert(Workout_Popout(item=self.item), large=True, buttons=[("Completed", True), ("Close", False)])
    if result:
      self.item['completed'] = result
      self.outlined_card_1.background = "theme:Disabled Container"
      self.check_box.checked = self.item['completed']


  def check_box_change(self, **event_args):
    """This method is called when this checkbox is checked or unchecked"""
    self.item['completed'] = self.check_box.checked
    if self.item['completed']:
      self.outlined_card_1.background = "theme:Disabled Container"
    else:
      self.outlined_card_1.background = "theme:On Tertiary"
