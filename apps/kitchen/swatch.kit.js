(() => {
  function getFace(){
    let swObject = undefined;

    function init(gps, sw) {
      swObject = sw;
      g.clear();
    }

    function freeResources() {}
    
    function startTimer() {
      swObject.startTimer();
    }
    
    function stopTimer() {
      swObject.stopTimer();
    }

    function onButtonShort(btn) {
      switch (btn) {
      case 1:
        swObject.stopStart();
        break;
      case 2:
        swObject.lapOrReset();
        break;
      case 3:
      default:
        return;
      }
    }
    
    function onButtonLong(btn) {}

    return {init:init, freeResources:freeResources, startTimer:startTimer, stopTimer:stopTimer,
            onButtonShort:onButtonShort, onButtonLong:onButtonLong};
  }

  return getFace;
})();
