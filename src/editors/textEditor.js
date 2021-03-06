var texteditor = {
  isCellEdited: false,

  /**
   * Returns caret position in edit proxy
   * @author http://stackoverflow.com/questions/263743/how-to-get-caret-position-in-textarea
   * @return {Number}
   */
  getCaretPosition: function (keyboardProxy) {
    var el = keyboardProxy[0];
    if (el.selectionStart) {
      return el.selectionStart;
    }
    else if (document.selection) {
      el.focus();
      var r = document.selection.createRange();
      if (r == null) {
        return 0;
      }
      var re = el.createTextRange(),
        rc = re.duplicate();
      re.moveToBookmark(r.getBookmark());
      rc.setEndPoint('EndToStart', re);
      return rc.text.length;
    }
    return 0;
  },

  /**
   * Sets caret position in edit proxy
   * @author http://blog.vishalon.net/index.php/javascript-getting-and-setting-caret-position-in-textarea/
   * @param {Number}
   */
  setCaretPosition: function (keyboardProxy, pos) {
    var el = keyboardProxy[0];
    if (el.setSelectionRange) {
      el.focus();
      el.setSelectionRange(pos, pos);
    }
    else if (el.createTextRange) {
      var range = el.createTextRange();
      range.collapse(true);
      range.moveEnd('character', pos);
      range.moveStart('character', pos);
      range.select();
    }
  },

  /**
   * Shows text input in grid cell
   */
  beginEditing: function (instance, td, row, col, prop, keyboardProxy, useOriginalValue, suffix) {
    if (texteditor.isCellEdited) {
      return;
    }
    texteditor.isCellEdited = true;

    var coords = {row: row, col: col};
    instance.view.scrollViewport(coords);
    instance.view.render();

    keyboardProxy.on('cut.editor', function (event) {
      event.stopPropagation();
    });

    keyboardProxy.on('paste.editor', function (event) {
      event.stopPropagation();
    });

    if (!instance.getCellMeta(row, col).isWritable) {
      return;
    }

    if (useOriginalValue) {
      var original = instance.getDataAtCell(row, prop);
      original = Handsontable.helper.stringify(original) + (suffix || '');
      keyboardProxy.val(original);
      texteditor.setCaretPosition(keyboardProxy, original.length);
    }
    else {
      keyboardProxy.val('');
    }

    if (instance.getSettings().asyncRendering) {
      setTimeout(function () {
        texteditor.refreshDimensions(instance, row, col, keyboardProxy);
      }, 0);
    }
    else {
      texteditor.refreshDimensions(instance, row, col, keyboardProxy);
    }
  },

  refreshDimensions: function (instance, row, col, keyboardProxy) {
    if (!texteditor.isCellEdited) {
      return;
    }

    ///start prepare textarea position
    var $td = $(instance.getCell(row, col)); //because old td may have been scrolled out with scrollViewport
    var currentOffset = $td.offset();
    var containerOffset = instance.rootElement.offset();
    var scrollTop = instance.rootElement.scrollTop();
    var scrollLeft = instance.rootElement.scrollLeft();
    var editTop = currentOffset.top - containerOffset.top + scrollTop - 1;
    var editLeft = currentOffset.left - containerOffset.left + scrollLeft - 1;

    var settings = instance.getSettings();
    var rowHeadersCount = settings.rowHeaders === false ? 0 : 1;
    var colHeadersCount = settings.colHeaders === false ? 0 : 1;

    if (editTop < 0) {
      editTop = 0;
    }
    if (editLeft < 0) {
      editLeft = 0;
    }

    if (rowHeadersCount > 0 && parseInt($td.css('border-top-width')) > 0) {
      editTop += 1;
    }
    if (colHeadersCount > 0 && parseInt($td.css('border-left-width')) > 0) {
      editLeft += 1;
    }

    if ($.browser.msie && parseInt($.browser.version, 10) <= 7) {
      editTop -= 1;
    }

    keyboardProxy.parent().addClass('htHidden').css({
      top: editTop,
      left: editLeft
    });
    ///end prepare textarea position

    var width = $td.width()
      , height = $td.outerHeight() - 4;

    if (parseInt($td.css('border-top-width')) > 0) {
      height -= 1;
    }
    if (parseInt($td.css('border-left-width')) > 0) {
      if (rowHeadersCount > 0) {
        width -= 1;
      }
    }

    keyboardProxy.autoResize({
      maxHeight: 200,
      minHeight: height,
      minWidth: width,
      maxWidth: Math.max(168, width),
      animate: false,
      extraSpace: 0
    });

    keyboardProxy.parent().removeClass('htHidden');

    instance.rootElement.triggerHandler('beginediting.handsontable');

    setTimeout(function () {
      //async fix for Firefox 3.6.28 (needs manual testing)
      keyboardProxy.parent().css({
        overflow: 'visible'
      });
    }, 1);
  },

  /**
   * Finishes text input in selected cells
   */
  finishEditing: function (instance, td, row, col, prop, keyboardProxy, isCancelled, ctrlDown) {
    if (texteditor.triggerOnlyByDestroyer) {
      return;
    }
    if (texteditor.isCellEdited) {
      texteditor.isCellEdited = false;
      var val;
      if (isCancelled) {
        val = [
          [texteditor.originalValue]
        ];
      }
      else {
        val = [
          [$.trim(keyboardProxy.val())]
        ];
      }
      if (ctrlDown) { //if ctrl+enter and multiple cells selected, behave like Excel (finish editing and apply to all cells)
        var sel = instance.getSelected();
        instance.populateFromArray({row: sel[0], col: sel[1]}, val, {row: sel[2], col: sel[3]}, false, 'edit');
      }
      else {
        instance.populateFromArray({row: row, col: col}, val, null, false, 'edit');
      }
    }
    keyboardProxy.off(".editor");
    instance.view.wt.update('onCellDblClick', null);

    keyboardProxy.css({
      width: 0,
      height: 0
    });
    keyboardProxy.parent().addClass('htHidden').css({
      overflow: 'hidden'
    });

    instance.rootElement.triggerHandler('finishediting.handsontable');
  }
};

/**
 * Default text editor
 * @param {Object} instance Handsontable instance
 * @param {Element} td Table cell where to render
 * @param {Number} row
 * @param {Number} col
 * @param {String|Number} prop Row object property name
 * @param {Object} keyboardProxy jQuery element of keyboard proxy that contains current editing value
 * @param {Object} cellProperties Cell properites (shared by cell renderer and editor)
 */
Handsontable.TextEditor = function (instance, td, row, col, prop, keyboardProxy, cellProperties) {
  texteditor.isCellEdited = false;
  texteditor.originalValue = instance.getDataAtCell(row, prop);
  texteditor.triggerOnlyByDestroyer = cellProperties.strict;

  keyboardProxy.parent().addClass('htHidden').css({
    top: 0,
    left: 0,
    overflow: 'hidden'
  });
  keyboardProxy.css({
    width: 0,
    height: 0
  });

  /*keyboardProxy.on('blur.editor', function () {
    if (texteditor.isCellEdited) {
      texteditor.finishEditing(instance, null, row, col, prop, keyboardProxy, false);
    }
  });*/

  keyboardProxy.on('refreshBorder.editor', function () {
    setTimeout(function () {
      if (texteditor.isCellEdited) {
        texteditor.refreshDimensions(instance, row, col, keyboardProxy);
      }
    }, 0);
  });

  keyboardProxy.on("keydown.editor", function (event) {
    var ctrlDown = (event.ctrlKey || event.metaKey) && !event.altKey; //catch CTRL but not right ALT (which in some systems triggers ALT+CTRL)
    if (Handsontable.helper.isPrintableChar(event.keyCode)) {
      if (!texteditor.isCellEdited && !ctrlDown) { //disregard CTRL-key shortcuts
        texteditor.beginEditing(instance, null, row, col, prop, keyboardProxy);
        event.stopImmediatePropagation();
      }
      else if (ctrlDown) {
        if (texteditor.isCellEdited && event.keyCode === 65) { //CTRL + A
          event.stopPropagation();
        }
        else if (texteditor.isCellEdited && event.keyCode === 88 && $.browser.opera) { //CTRL + X
          event.stopPropagation();
        }
        else if (texteditor.isCellEdited && event.keyCode === 86 && $.browser.opera) { //CTRL + V
          event.stopPropagation();
        }
      }
      return;
    }

    if (texteditor.isCellEdited && (event.keyCode === 17 || event.keyCode === 224 || event.keyCode === 91 || event.keyCode === 93)) {
      //when CTRL is pressed and cell is edited, don't prepare selectable text in textarea
      event.stopPropagation();
      return;
    }

    switch (event.keyCode) {
      case 38: /* arrow up */
        if (texteditor.isCellEdited) {
          texteditor.finishEditing(instance, null, row, col, prop, keyboardProxy, false);
        }
        break;

      case 9: /* tab */
        if (texteditor.isCellEdited) {
          texteditor.finishEditing(instance, null, row, col, prop, keyboardProxy, false);
        }
        event.preventDefault();
        break;

      case 39: /* arrow right */
        if (texteditor.isCellEdited) {
          if (texteditor.getCaretPosition(keyboardProxy) === keyboardProxy.val().length) {
            texteditor.finishEditing(instance, null, row, col, prop, keyboardProxy, false);

          }
          else {
            event.stopPropagation();
          }
        }
        break;

      case 37: /* arrow left */
        if (texteditor.isCellEdited) {
          if (texteditor.getCaretPosition(keyboardProxy) === 0) {
            texteditor.finishEditing(instance, null, row, col, prop, keyboardProxy, false);
          }
          else {
            event.stopPropagation();
          }
        }
        break;

      case 8: /* backspace */
      case 46: /* delete */
        if (texteditor.isCellEdited) {
          event.stopPropagation();
        }
        break;

      case 40: /* arrow down */
        if (texteditor.isCellEdited) {
          texteditor.finishEditing(instance, null, row, col, prop, keyboardProxy, false);
        }
        break;

      case 27: /* ESC */
        if (texteditor.isCellEdited) {
          instance.destroyEditor(true);
          event.stopPropagation();
        }
        break;

      case 113: /* F2 */
        if (!texteditor.isCellEdited) {
          texteditor.beginEditing(instance, null, row, col, prop, keyboardProxy, true); //show edit field
          event.stopPropagation();
          event.preventDefault(); //prevent Opera from opening Go to Page dialog
        }
        break;

      case 13: /* return/enter */
        if (texteditor.isCellEdited) {
          var selected = instance.getSelected();
          var isMultipleSelection = !(selected[0] === selected[2] && selected[1] === selected[3]);
          if ((event.ctrlKey && !isMultipleSelection) || event.altKey) { //if ctrl+enter or alt+enter, add new line
            keyboardProxy.val(keyboardProxy.val() + '\n');
            keyboardProxy[0].focus();
            event.stopPropagation();
          }
          else {
            texteditor.finishEditing(instance, null, row, col, prop, keyboardProxy, false, ctrlDown);
          }
        }
        else if (instance.getSettings().enterBeginsEditing) {
          if ((ctrlDown && !selection.isMultiple()) || event.altKey) { //if ctrl+enter or alt+enter, add new line
            texteditor.beginEditing(instance, null, row, col, prop, keyboardProxy, true, '\n'); //show edit field
          }
          else {
            texteditor.beginEditing(instance, null, row, col, prop, keyboardProxy, true); //show edit field
          }
          event.stopPropagation();
        }
        event.preventDefault(); //don't add newline to field
        break;

      case 36: /* home */
        if (texteditor.isCellEdited) {
          event.stopPropagation();
        }
        break;

      case 35: /* end */
        if (texteditor.isCellEdited) {
          event.stopPropagation();
        }
        break;
    }
  });

  function onDblClick() {
    keyboardProxy[0].focus();
    texteditor.beginEditing(instance, null, row, col, prop, keyboardProxy, true);
  }

  instance.view.wt.update('onCellDblClick', onDblClick);

  return function (isCancelled) {
    texteditor.triggerOnlyByDestroyer = false;
    texteditor.finishEditing(instance, null, row, col, prop, keyboardProxy, isCancelled);
  }
};