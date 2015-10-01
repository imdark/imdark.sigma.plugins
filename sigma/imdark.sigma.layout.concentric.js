;(function(undefined) {
  'use strict';

  if (typeof sigma === 'undefined')
    throw new Error('sigma is not declared');

  // Initialize package:
  sigma.utils.pkg('sigma.layouts');

  /**
   * Sigma concentric
   * ===============================
   *
   * Author: Michael Kris (Imdark)
   * ForceLink Author: Guillaume Plique (Yomguithereal)
   * Extensions author: Sébastien Heymann @ Linkurious
   * Version: 0.1
   */
var defaults = {
    fit: true, // whether to fit the viewport to the graph
    padding: 30, // the padding on fit
    startAngle: 3/2 * Math.PI, // the position of the first node
    counterclockwise: false, // whether the layout should go counterclockwise/anticlockwise (true) or clockwise (false)
    minNodeSpacing: 10, // min spacing between outside of nodes (used for radius adjustment)
    boundingBox: undefined, // constrain layout bounds; { x1, y1, x2, y2 } or { x1, y1, w, h }
    avoidOverlap: true, // prevents node overlap, may overflow boundingBox if not enough space
    height: undefined, // height of layout area (overrides container height)
    width: undefined, // width of layout area (overrides container width)
    concentric: function(node){ // returns numeric value for each node, placing higher nodes in levels towards the centre
      return Math.floor(Math.random() * 10);
    },
    levelWidth: function(nodes){ // the variation of concentric values in each level
      // return nodes.maxDegree() / 4;
      return 5;
    },
    animate: false, // whether to transition the node positions
    animationDuration: 500, // duration of animation in ms if enabled
    ready: undefined, // callback on layoutready
    stop: undefined // callback on layoutstop
  };

  var util = {
    makeBoundingBox: function( bb ) {
      if( bb.x1 != null && bb.y1 != null ){
        if( bb.x2 != null && bb.y2 != null && bb.x2 >= bb.x1 && bb.y2 >= bb.y1 ){
          return {
            x1: bb.x1,
            y1: bb.y1,
            x2: bb.x2,
            y2: bb.y2,
            w: bb.x2 - bb.x1,
            h: bb.y2 - bb.y1
          };
        } else if( bb.w != null && bb.h != null && bb.w >= 0 && bb.h >= 0 ){
          return {
            x1: bb.x1,
            y1: bb.y1,
            x2: bb.x1 + bb.w,
            y2: bb.y1 + bb.h,
            w: bb.w,
            h: bb.h
          };
        }
      }
    },
    extend: function() {
      var i,
          k,
          res = {},
          l = arguments.length;

      for (i = l - 1; i >= 0; i--)
        for (k in arguments[i])
          res[k] = arguments[i][k];
      return res;
    },
    __emptyObject: function(obj) {
      var k;

      for (k in obj)
        if (!('hasOwnProperty' in obj) || obj.hasOwnProperty(k))
          delete obj[k];

      return obj;
    },

    /**
     * Return the euclidian distance between two points of a plane
     * with an orthonormal basis.
     *
     * @param  {number} x1  The X coordinate of the first point.
     * @param  {number} y1  The Y coordinate of the first point.
     * @param  {number} x2  The X coordinate of the second point.
     * @param  {number} y2  The Y coordinate of the second point.
     * @return {number}     The euclidian distance.
     */
    getDistance: function(x0, y0, x1, y1) {
      return Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0));
    },

    /**
     * Return the coordinates of the intersection points of two circles.
     *
     * @param  {number} x0  The X coordinate of center location of the first
     *                      circle.
     * @param  {number} y0  The Y coordinate of center location of the first
     *                      circle.
     * @param  {number} r0  The radius of the first circle.
     * @param  {number} x1  The X coordinate of center location of the second
     *                      circle.
     * @param  {number} y1  The Y coordinate of center location of the second
     *                      circle.
     * @param  {number} r1  The radius of the second circle.
     * @return {xi,yi}      The coordinates of the intersection points.
     */
    getCircleIntersection: function(x0, y0, r0, x1, y1, r1) {
      // http://stackoverflow.com/a/12219802
      var a, dx, dy, d, h, rx, ry, x2, y2;

      // dx and dy are the vertical and horizontal distances between the circle
      // centers:
      dx = x1 - x0;
      dy = y1 - y0;

      // Determine the straight-line distance between the centers:
      d = Math.sqrt((dy * dy) + (dx * dx));

      // Check for solvability:
      if (d > (r0 + r1)) {
          // No solution. circles do not intersect.
          return false;
      }
      if (d < Math.abs(r0 - r1)) {
          // No solution. one circle is contained in the other.
          return false;
      }

      //'point 2' is the point where the line through the circle intersection
      // points crosses the line between the circle centers.

      // Determine the distance from point 0 to point 2:
      a = ((r0 * r0) - (r1 * r1) + (d * d)) / (2.0 * d);

      // Determine the coordinates of point 2:
      x2 = x0 + (dx * a / d);
      y2 = y0 + (dy * a / d);

      // Determine the distance from point 2 to either of the intersection
      // points:
      h = Math.sqrt((r0 * r0) - (a * a));

      // Determine the offsets of the intersection points from point 2:
      rx = -dy * (h / d);
      ry = dx * (h / d);

      // Determine the absolute intersection points:
      var xi = x2 + rx;
      var xi_prime = x2 - rx;
      var yi = y2 + ry;
      var yi_prime = y2 - ry;

      return {xi: xi, xi_prime: xi_prime, yi: yi, yi_prime: yi_prime};
    },

    /**
     * Find the intersection between two lines, two segments, or one line and one segment.
     * http://jsfiddle.net/justin_c_rounds/Gd2S2/
     *
     * @param  {number} line1x1  The X coordinate of the start point of the first line.
     * @param  {number} line1y1  The Y coordinate of the start point of the first line.
     * @param  {number} line1x2  The X coordinate of the end point of the first line.
     * @param  {number} line1y2  The Y coordinate of the end point of the first line.v
     * @param  {number} line2x1  The X coordinate of the start point of the second line.
     * @param  {number} line2y1  The Y coordinate of the start point of the second line.
     * @param  {number} line2x2  The X coordinate of the end point of the second line.
     * @param  {number} line2y2  The Y coordinate of the end point of the second line.
     * @return {object}           The coordinates of the intersection point.
     */
    getLinesIntersection: function(line1x1, line1y1, line1x2, line1y2, line2x1, line2y1, line2x2, line2y2) {
      // if the lines intersect, the result contains the x and y of the intersection
      // (treating the lines as infinite) and booleans for whether line segment 1 or
      // line segment 2 contain the point
      var
        denominator,
        a,
        b,
        numerator1,
        numerator2,
        result = {
          x: null,
          y: null,
          onLine1: false,
          onLine2: false
      };

      denominator =
        ((line2y2 - line2y1) * (line1x2 - line1x1)) -
        ((line2x2 - line2x1) * (line1y2 - line1y1));

      if (denominator == 0) {
          return result;
      }

      a = line1y1 - line2y1;
      b = line1x1 - line2x1;

      numerator1 = ((line2x2 - line2x1) * a) - ((line2y2 - line2y1) * b);
      numerator2 = ((line1x2 - line1x1) * a) - ((line1y2 - line1y1) * b);

      a = numerator1 / denominator;
      b = numerator2 / denominator;

      // if we cast these lines infinitely in both directions, they intersect here:
      result.x = line1x1 + (a * (line1x2 - line1x1));
      result.y = line1y1 + (a * (line1y2 - line1y1));
      /*
      // it is worth noting that this should be the same as:
        x = line2x1 + (b * (line2x2 - line2x1));
        y = line2x1 + (b * (line2y2 - line2y1));
      */
      // if line1 is a segment and line2 is infinite, they intersect if:
      if (a > 0 && a < 1) {
          result.onLine1 = true;
      }
      // if line2 is a segment and line1 is infinite, they intersect if:
      if (b > 0 && b < 1) {
          result.onLine2 = true;
      }
      // if line1 and line2 are segments, they intersect if both of the above are true
      return result;
    },

    /**
     * Scale a value from the range [baseMin, baseMax] to the range
     * [limitMin, limitMax].
     *
     * @param  {number} value    The value to rescale.
     * @param  {number} baseMin  The min value of the range of origin.
     * @param  {number} baseMax  The max value of the range of origin.
     * @param  {number} limitMin The min value of the range of destination.
     * @param  {number} limitMax The max value of the range of destination.
     * @return {number}          The scaled value.
     */
    scaleRange: function(value, baseMin, baseMax, limitMin, limitMax) {
      return ((limitMax - limitMin) * (value - baseMin) / (baseMax - baseMin)) + limitMin;
    },

    /**
     * Get the angle of the vector (in radian).
     *
     * @param  {object} v  The 2d vector with x,y coordinates.
     * @return {number}    The angle of the vector  (in radian).
     */
    getVectorAngle: function(v) {
      return Math.acos( v.x / Math.sqrt(v.x * v.x + v.y * v.y) );
    },

    /**
     * Get the normal vector of the line segment, i.e. the vector
     * orthogonal to the line.
     * http://stackoverflow.com/a/1243614/
     *
     * @param  {number} aX The x coorinates of the start point.
     * @param  {number} aY The y coorinates of the start point.
     * @param  {number} bX The x coorinates of the end point.
     * @param  {number} bY The y coorinates of the end point.
     * @return {object}    The 2d vector with (xi,yi), (xi_prime,yi_prime) coordinates.
     */
    getNormalVector: function(aX, aY, bX, bY) {
      return {
        xi:       -(bY - aY),
        yi:         bX - aX,
        xi_prime:   bY - aY,
        yi_prime: -(bX - aX)
      };
    },

    /**
     * Get the normalized vector.
     *
     * @param  {object} v      The 2d vector with (xi,yi), (xi_prime,yi_prime) coordinates.
     * @param  {number} length The vector length.
     * @return {object}        The normalized vector
     */
    getNormalizedVector: function(v, length) {
      return {
        x: (v.xi_prime - v.xi) / length,
        y: (v.yi_prime - v.yi) / length,
      };
    },

    /**
     * Get the a point the line segment [A,B] at a specified distance percentage
     * from the start point.
     *
     * @param  {number} aX The x coorinates of the start point.
     * @param  {number} aY The y coorinates of the start point.
     * @param  {number} bX The x coorinates of the end point.
     * @param  {number} bY The y coorinates of the end point.
     * @param  {number} t  The distance percentage from the start point.
     * @return {object}    The (x,y) coordinates of the point.
     */
    getPointOnLineSegment: function(aX, aY, bX, bY, t) {
      return {
        x: aX + (bX - aX) * t,
        y: aY + (bY - aY) * t
      };
    }
  };

  var ConcentricLayout = function( options ) {
    this.options = util.extend(defaults, defaults);
  }

  ConcentricLayout.prototype.pass = function(nodes) {
    var params = this.options;
    var options = params;

    var cy = params.cy;

    // var eles = options.eles;
    var nodes = nodes();

    var bb = util.makeBoundingBox( options.boundingBox ? options.boundingBox : {
      x1: 0, y1: 0, w: 300, h: 200
    } );

    var center = {
      x: bb.x1 + bb.w/2,
      y: bb.y1 + bb.h/2
    };

    var nodeValues = []; // { node, value }
    var theta = options.startAngle;
    var maxNodeSize = 0;

    for( var i = 0; i < nodes.length; i++ ) {
      var node = nodes[i];
      var value;

      // calculate the node value
      value = options.concentric.apply(node, [ node ]);
      nodeValues.push({
        value: value,
        node: node
      });
    }

    // calculate max size now based on potentially updated mappers
    for( var i = 0; i < nodes.length; i++ ) {
      var node = nodes[i];

      maxNodeSize = Math.max( maxNodeSize, node.size);
    }

    // sort node values in descreasing order
    nodeValues.sort(function(a, b) {
      return b.value - a.value;
    });

    var levelWidth = options.levelWidth( nodes );

    // put the values into levels
    var levels = [ [] ];
    var currentLevel = levels[0];
    for( var i = 0; i < nodeValues.length; i++ ) {
      var val = nodeValues[i];

      if( currentLevel.length > 0 ){
        var diff = Math.abs( currentLevel[0].value - val.value );

        if( diff >= levelWidth ){
          currentLevel = [];
          levels.push( currentLevel );
        }
      }

      currentLevel.push( val );
    }

    // create positions from levels

    var pos = {}; // id => position
    var r = 0;
    var minDist = maxNodeSize + options.minNodeSpacing; // min dist between nodes

    if( !options.avoidOverlap ){ // then strictly constrain to bb
      var firstLvlHasMulti = levels.length > 0 && levels[0].length > 1;
      var maxR = ( Math.min(bb.w, bb.h) / 2 - minDist );
      var rStep = maxR / ( levels.length + firstLvlHasMulti ? 1 : 0 );

      minDist = Math.min( minDist, rStep );
    }

    for( var i = 0; i < levels.length; i++ ) {
      var level = levels[i];
      var dTheta = 2 * Math.PI / level.length;

      // calculate the radius
      if( level.length > 1 && options.avoidOverlap ) { // but only if more than one node (can't overlap)
        var dcos = Math.cos(dTheta) - Math.cos(0);
        var dsin = Math.sin(dTheta) - Math.sin(0);
        var rMin = Math.sqrt( minDist * minDist / ( dcos*dcos + dsin*dsin ) ); // s.t. no nodes overlapping
        r = Math.max( rMin, r );
      }

      for( var j = 0; j < level.length; j++ ) {
        var val = level[j];
        var theta = options.startAngle + (options.counterclockwise ? -1 : 1) * dTheta * j;

        val.node.x = center.x + r * Math.cos(theta),
        val.node.y = center.y + r * Math.sin(theta)
      }

      r += minDist;

    }
  }

  /**
   * Interface
   * ----------
   */
  var concentricLayout = new ConcentricLayout();
  
  sigma.layouts.configConcentric = function(config) {
    concentricLayout = new ConcentricLayout(config)
  };

  sigma.layouts.startConcentric = function(sigInst) {
    concentricLayout.pass(sigInst.graph.nodes);
    sigInst.refresh();
  };

}).call(this);